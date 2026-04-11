Place un fichier GeoJSON ici pour afficher une carte cliquable sur `/dashboard`.

- Nom attendu : `territories.geojson`
- Format : `FeatureCollection` avec des `Polygon` / `MultiPolygon`
- Propriété utilisée comme identifiant : `properties.name`

Exemple minimal (structure) :

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Ouest" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[ -72.0, 19.9 ], [ -71.4, 19.9 ], [ -71.4, 18.7 ], [ -72.0, 18.7 ], [ -72.0, 19.9 ]]]
      }
    }
  ]
}
```

