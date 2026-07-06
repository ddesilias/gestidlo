import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';

/**
 * Spec de fumée d'AppComponent. Le scaffold d'origine plantait (`No provider for HttpClient`) et
 * assertait du contenu scaffold (h1 « Hello, spa ») que l'app réelle n'a pas — remplacé par les
 * providers requis (HttpClient testing + Router) et une assertion vraie (le composant se crée).
 */
describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('se crée', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it(`porte le titre 'spa'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toEqual('spa');
  });
});
