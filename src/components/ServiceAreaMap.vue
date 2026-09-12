<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
const props = defineProps({ text: Object, locale: String });
// GeoNames coordinates; this is an indicative service footprint, not a boundary map.
// Latitude/longitude are projected locally so the map needs no API, tiles or tracking.
const project = ([lon, lat]) => [60 + (lon - 34.55) * 700, 45 + (32.5 - lat) * 640];
const line = points => points.map(point => project(point).join(',')).join(' ');
const coast = [[34.902,32.57],[34.881,32.47],[34.866,32.40],[34.845,32.333],[34.822,32.26],[34.797,32.18],[34.770,32.10],[34.758,32.058],[34.738,32.02],[34.719,31.96],[34.688,31.90],[34.640,31.834],[34.613,31.75],[34.58,31.67]];
const coastline = line(coast);
const coverage = line([[34.881,32.47],[34.966,32.47],[34.964,32.36],[34.950,32.22],[34.964,32.09],[34.917,32.00],[34.871,31.87],[34.703,31.755],[34.613,31.75],...coast.slice(1,12).reverse()]);
const cities = computed(() => [
  { index: 11, point: [34.9039,32.4419] },
  { index: 3, point: [34.8599,32.3329] },
  { index: 0, point: [34.7806,32.0809] },
  { index: 8, point: [34.8120,31.8942] },
  { index: 5, point: [34.6497,31.7921] },
].map(city => ({ ...city, xy: project(city.point), name: props.text.cities[city.index] })));
</script>

<template>
  <figure class="service-map">
    <div class="map-heading"><span class="map-swatch" aria-hidden="true"></span>{{ text.map.title }}</div>
    <svg class="region-map" viewBox="0 0 480 550" role="img" aria-labelledby="map-title map-description">
      <title id="map-title">{{ text.regionTitle }}</title>
      <desc id="map-description">{{ text.map.note }} {{ text.cities.join(', ') }}</desc>
      <rect width="480" height="550" fill="#dce8e3" />
      <polygon :points="`${coastline} 480,590 480,-30`" fill="#f6f1e6" />
      <polygon :points="coverage" fill="#ba634244" stroke="#b74a31" stroke-width="1.5" stroke-dasharray="5 5" stroke-linejoin="round" />
      <polyline :points="coastline" fill="none" stroke="#749c90" stroke-width="2" />
      <text x="90" y="245" class="sea-label" text-anchor="middle" :direction="['he','ar'].includes(locale) ? 'rtl' : 'ltr'">
        <tspan x="90">{{ text.map.sea }}</tspan>
      </text>
      <g class="map-north" transform="translate(38 42)" aria-hidden="true">
        <path d="M0 21V0m-6 7L0 0l6 7" fill="none" stroke="currentColor" stroke-width="1.5" />
        <text x="0" y="42" text-anchor="middle">{{ text.map.north }}</text>
      </g>
      <g v-for="city in cities" :key="city.index">
        <circle :cx="city.xy[0]" :cy="city.xy[1]" r="6" fill="#b74a31" stroke="#fffaf0" stroke-width="2.5" />
        <text :x="city.xy[0] + 15" :y="city.xy[1] + 5" class="map-city" text-anchor="start" direction="ltr" unicode-bidi="plaintext">{{ city.name }}</text>
      </g>
    </svg>
    <figcaption>
      <p>{{ text.map.note }}</p>
      <div class="map-links">
        <a class="map-open" href="https://www.openstreetmap.org/?minlon=34.58&amp;minlat=31.74&amp;maxlon=35.02&amp;maxlat=32.50" target="_blank" rel="noopener noreferrer">{{ text.map.open }}<Icon name="external" :size="17" /></a>
        <a class="map-attribution" href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames · CC BY 4.0</a>
      </div>
    </figcaption>
  </figure>
</template>

<style scoped>
.service-map { margin: 0; min-width: 0; overflow: hidden; align-self: start; background: var(--paper); border: 1px solid #baa88a; border-radius: 4px; }
.map-heading { display: flex; align-items: center; gap: 10px; padding: 18px 22px; font-size: 1rem; font-weight: 600; border-bottom: 1px solid var(--line); }
.map-swatch { width: 16px; height: 16px; background: #ba634244; border: 1px dashed var(--accent); }
.region-map { display: block; width: 100%; height: auto; color: var(--ink); font-family: inherit; }
.map-city { font-size: 17px; font-weight: 550; fill: var(--ink); paint-order: stroke; stroke: var(--paper); stroke-width: 5px; stroke-linejoin: round; }
.sea-label { font-size: 14px; fill: #4b756b; }
.map-north { font-size: 13px; }
figcaption { padding: 18px 22px; border-top: 1px solid var(--line); }
figcaption p { margin: 0; font-size: .875rem; line-height: 1.65; color: var(--muted); }
.map-links { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 18px; margin-top: 10px; }
.map-open { display: inline-flex; gap: 8px; align-items: center; min-height: 44px; font-size: .875rem; text-decoration: underline; text-underline-offset: 4px; }
.map-attribution { font-size: .75rem; color: var(--muted); }
@media(max-width:440px) { .map-city { font-size: 24px; } .sea-label { font-size: 18px; } }
</style>
