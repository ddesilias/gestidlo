package com.example.api_metier.web;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import com.example.api_metier.domain.UserAccountEntity;
import com.example.api_metier.domain.UserProfileEntity;
import com.example.api_metier.repo.UserAccountRepository;
import com.example.api_metier.repo.UserProfileRepository;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthenticationManager authenticationManager;
	private final JwtEncoder jwtEncoder;
	private final UserAccountRepository userAccounts;
	private final UserProfileRepository userProfiles;
	private final PasswordEncoder passwordEncoder;

	public AuthController(AuthenticationManager authenticationManager, JwtEncoder jwtEncoder,
			UserAccountRepository userAccounts, UserProfileRepository userProfiles, PasswordEncoder passwordEncoder) {
		this.authenticationManager = authenticationManager;
		this.jwtEncoder = jwtEncoder;
		this.userAccounts = userAccounts;
		this.userProfiles = userProfiles;
		this.passwordEncoder = passwordEncoder;
	}

	@PostMapping("/login")
	public LoginResponse login(@RequestBody LoginRequest request) {
		String identifier = request.email() == null ? "" : request.email().trim();
		if (identifier.isBlank() || request.password() == null || request.password().isBlank()) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiant et mot de passe requis");
		}

		// Login tolérant : l'identifiant peut être un email (s'il contient « @ ») ou un username.
		// On résout vers le username (clé d'auth), puis Spring Security authentifie par username.
		// user_profiles reste la source unique des claims (email/nom/urdId/dept).
		String username = resolveUsername(identifier);
		if (username == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants incorrects");
		}

		Authentication auth;
		try {
			auth = authenticationManager.authenticate(
					new UsernamePasswordAuthenticationToken(username, request.password()));
		} catch (BadCredentialsException e) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants incorrects");
		}

		UserProfileEntity profile = userProfiles.findById(auth.getName()).orElse(null);
		String email   = profile != null ? profile.getEmail()   : null;
		String nom     = profile != null ? profile.getNom()     : null;
		String urdId   = profile != null ? profile.getUrdId()   : null;
		String dept    = profile != null ? profile.getDept()    : null;
		String commune = profile != null ? profile.getCommune() : null;

		Instant now = Instant.now();
		Instant exp = now.plus(8, ChronoUnit.HOURS);
		List<String> roles = auth.getAuthorities().stream()
				.map(GrantedAuthority::getAuthority)
				.filter(a -> a.startsWith("ROLE_"))
				.map(a -> a.substring("ROLE_".length()))
				.sorted()
				.collect(Collectors.toList());

		// Le scope (urdId/dept) est embarqué dans le token : c'est lui qui imposera le périmètre,
		// jamais l'affichage client. Claims omis si null (compte admin sans URD).
		JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
				.subject(auth.getName())
				.issuedAt(now)
				.expiresAt(exp)
				.claim("roles", roles)
				.claim("email", email == null ? "" : email)
				.claim("nom", nom == null ? "" : nom);
		if (urdId != null) claims.claim("urdId", urdId);
		if (dept != null) claims.claim("dept", dept);
		// Commune : périmètre fin du TEPAC (claim consommé par le résolveur de scope serveur).
		if (commune != null) claims.claim("commune", commune);

		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
		return new LoginResponse(token, auth.getName(), email, nom, roles, urdId, dept, commune, exp);
	}

	/**
	 * Résout un identifiant de login (email ou username) vers le username (clé d'auth).
	 * Email s'il contient « @ » (via user_profiles), sinon username direct (via user_accounts),
	 * avec repli sur l'email — pour ne jamais bloquer un utilisateur sur la forme de l'identifiant.
	 */
	private String resolveUsername(String identifier) {
		if (identifier.contains("@")) {
			return userProfiles.findByEmailIgnoreCase(identifier)
					.map(UserProfileEntity::getUsername).orElse(null);
		}
		String uname = identifier.toLowerCase();
		if (userAccounts.existsById(uname)) {
			return uname;
		}
		return userProfiles.findByEmailIgnoreCase(identifier)
				.map(UserProfileEntity::getUsername).orElse(null);
	}

	@GetMapping("/me")
	public MeResponse me(Authentication auth) {
		List<String> roles = auth.getAuthorities().stream()
				.map(GrantedAuthority::getAuthority)
				.filter(a -> a.startsWith("ROLE_"))
				.map(a -> a.substring("ROLE_".length()))
				.sorted()
				.toList();
		String email = null, nom = null, urdId = null, dept = null, commune = null;
		if (auth.getPrincipal() instanceof Jwt jwt) {
			email = jwt.getClaimAsString("email");
			nom = jwt.getClaimAsString("nom");
			urdId = jwt.getClaimAsString("urdId");
			dept = jwt.getClaimAsString("dept");
			commune = jwt.getClaimAsString("commune");
		}
		return new MeResponse(auth.getName(), email, nom, roles, urdId, dept, commune);
	}

	@PostMapping("/accounts")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasRole('ADMIN')")
	public AccountResponse createAccount(@RequestBody CreateAccountRequest request) {
		String username = request.username().trim().toLowerCase();
		if (username.isBlank() || request.password() == null || request.password().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nom d'utilisateur et mot de passe requis");
		}
		if (userAccounts.existsById(username)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Nom d'utilisateur déjà utilisé");
		}
		String roles = (request.roles() != null && !request.roles().isBlank())
				? request.roles().trim().toUpperCase() : "OPERATOR";
		UserAccountEntity entity = new UserAccountEntity(username, passwordEncoder.encode(request.password()), roles, true);
		userAccounts.save(entity);
		return new AccountResponse(entity.getUsername(), entity.getRoles(), entity.isActive());
	}

	@PostMapping("/logout")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void logout() {
		// stateless JWT => no server-side logout
	}

	public record LoginRequest(String email, String password) {}
	public record LoginResponse(String token, String username, String email, String nom,
			List<String> roles, String urdId, String dept, String commune, Instant expiresAt) {}
	public record MeResponse(String username, String email, String nom,
			List<String> roles, String urdId, String dept, String commune) {}
	public record CreateAccountRequest(String username, String password, String roles) {}
	public record AccountResponse(String username, String roles, boolean active) {}
}
