# PScan — mide la pendiente de un objeto desde una foto

App móvil (React Native + **Expo SDK 57**) que calcula la **pendiente / inclinación** de un
objeto a partir de una foto. Tomas una foto o eliges una de la galería, marcas puntos sobre el
borde del objeto y obtienes el ángulo en grados, la pendiente m y la proporción. Con varios
puntos, el trazo se convierte en una **función** (por tramos o una curva ajustada, estilo GeoGebra).

- **100 % offline.** Todo el cálculo es trigonometría y álgebra en el propio teléfono. No hay
  login, ni base de datos, ni llamadas a la red.
- **Minimalista**, con NativeWind (Tailwind para React Native).

---

## Índice

- [Qué hace](#qué-hace)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha rápida](#puesta-en-marcha-rápida-expo-go)
- [Los dos modos: Expo Go vs build nativo](#los-dos-modos-expo-go-vs-build-nativo)
- [Cómo se usa la app](#cómo-se-usa-la-app)
- [Compilar el APK de Android](#compilar-el-apk-de-android-standalone)
- [iOS (para que otros lo prueben)](#ios-para-que-otros-lo-prueben)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo funciona por dentro](#cómo-funciona-por-dentro)
- [Tests](#tests)
- [Stack tecnológico](#stack-tecnológico)
- [Solución de problemas](#solución-de-problemas)
- [Precisión (importante)](#precisión-importante)

---

## Qué hace

- **Cámara integrada** con **indicador de nivel** (acelerómetro) y **cruz guía** centrada (ejes
  de plano cartesiano) para apuntar derecho.
- **Selección desde la galería** (las fotos se normalizan: rotación EXIF aplicada físicamente).
- **Medición manual:** marca 2 puntos → ángulo (°), pendiente m y proporción (1:N). **Zoom** con
  pellizco de 2 dedos para afinar la posición de puntos y líneas.
- **Polilínea:** marca varios puntos → varios tramos, cada uno con su pendiente; juntos forman una
  **función lineal por tramos** `y = m·x + b`.
- **Curvas:** con 3+ puntos ajusta por mínimos cuadrados la mejor **recta, parábola o cúbica**
  (`y = a·x² + b·x + c`) con su R².
- **Detección automática (OpenCV):**
  - Con 0–1 puntos: detecta la **línea recta** dominante de la foto.
  - Con 2+ puntos: **imanta tu trazo al borde real** siguiendo la curva.
- **Interpretación en lenguaje llano:** categoriza la pendiente (suave/pronunciada/…) con
  referencias reales (rampa accesible, tejado, etc.).

---

## Requisitos previos

- **Node.js 20.19+ o 22.13+** (recomendado). Con 22.12 funciona pero verás warnings `EBADENGINE`.
- **npm** (viene con Node).
- Un **teléfono con [Expo Go](https://expo.dev/go)** o un emulador Android/iOS para la mayor parte
  del desarrollo. (La cámara real necesita dispositivo físico; la galería funciona en emulador.)
- Solo para compilar el APK: **Android Studio** (SDK + un JDK). Ver
  [Compilar el APK](#compilar-el-apk-de-android-standalone).

> El proyecto usa el enfoque **CNG** de Expo: las carpetas nativas `android/` e `ios/` **no** están
> en git; se generan con `npx expo prebuild` a partir de `app.json`. No hace falta tocarlas a mano.

---

## Puesta en marcha rápida (Expo Go)

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go**. Todo el flujo principal (cámara, galería, medición manual, polilínea,
ajuste de curvas, resultados) funciona en Expo Go.

> Para probar en un teléfono que no esté en tu red, usa `npx expo start --tunnel`.

---

## Los dos modos: Expo Go vs build nativo

| | Expo Go (sin compilar) | APK / build nativo |
|---|---|---|
| Medición manual, polilínea, curvas, cámara, galería, nivel | ✅ | ✅ |
| **Detección automática (OpenCV)** | ❌ | ✅ |

La detección automática usa `react-native-fast-opencv` (código nativo C++), que **no existe** en el
sandbox de Expo Go. Si pulsas ese botón en Expo Go, la app te lo explica y puedes seguir marcando a
mano. Para usarla, compila el APK (Android) o un dev/EAS build.

---

## Cómo se usa la app

1. **Inicio** → *Tomar foto* o *Elegir de galería*.
2. **Medición:**
   - Toca para **añadir puntos** sobre el borde del objeto.
   - **Arrastra** un punto para ajustarlo · **Deshacer** / **Limpiar**.
   - **Pellizca con 2 dedos** para hacer zoom (botón 1× para volver); un dedo sigue siendo para
     los puntos.
   - Con 2+ puntos aparece **"Ajustar a la curva (auto)"**: imanta el trazo al borde real (OpenCV).
3. **Resultados:**
   - **1 tramo** → ángulo, pendiente m y proporción.
   - **Varios tramos** → mini-gráfico de la función, **curva ajustada** (`y = a·x²+…`) con R²,
     ecuaciones por tramo y pendiente de cada tramo.
   - Desplegable **"¿Qué significa cada número?"** con la explicación de cada cifra.
4. **Reintentar** → vuelve al inicio.

---

## Compilar el APK de Android (standalone)

Genera un APK instalable que funciona **solo, sin conexión y sin Metro** (incluye OpenCV).

```bash
# 1) Generar el proyecto nativo (autolinkea OpenCV, etc.)
npx expo prebuild --platform android

# 2) Compilar el APK release
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

En **Windows**, si `java` del PATH es muy nuevo (JDK 24+), usa el JDK de Android Studio antes de
compilar:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'   # JDK 21
```

Alternativa en la nube (sin configurar Android local): `eas build -p android --profile preview`.

> **Poca RAM.** Tras `prebuild`, en `android/gradle.properties` puedes limitar el consumo:
> `org.gradle.jvmargs=-Xmx1536m`, `org.gradle.parallel=false`, `org.gradle.workers.max=2` y
> `reactNativeArchitectures=arm64-v8a` (solo móviles modernos). Reduce el build de ~4 GB a ~2 GB.

Para desarrollo con recarga en caliente sobre un dev build: `npx expo run:android`.

## iOS (para que otros lo prueben)

No se puede compilar iOS en Windows ni "instalar un IPA" como el APK. Se usa **EAS Build** (compila
en la nube macOS, no necesitas Mac). Para correr en el iPhone de otra persona hace falta una
**cuenta Apple Developer (99 USD/año)**.

```bash
npm install -g eas-cli
eas login          # cuenta de Expo (gratis)
eas init           # enlaza el proyecto (añade el projectId a app.json)

# Instalación directa (Ad Hoc), hasta 100 dispositivos:
eas device:create  # cada tester registra su iPhone abriendo el link
eas build -p ios --profile preview   # devuelve un link/QR para instalar

# O TestFlight (hasta 10 000 testers):
eas build -p ios --profile production
eas submit -p ios
```

**Sin cuenta Apple (gratis, limitado):** el tester instala **Expo Go** del App Store y tú corres
`npx expo start --tunnel`. La detección automática (OpenCV) no corre en Expo Go, pero sí el resto.

Los perfiles de build están en [`eas.json`](eas.json); el `bundleIdentifier` en [`app.json`](app.json).

---

## Estructura del proyecto

```
pscan/
├─ src/
│  ├─ app/                  # Pantallas (expo-router)
│  │  ├─ _layout.tsx        # Raíz: gestos + safe area + navegación + global.css
│  │  ├─ index.tsx          # Inicio (Tomar foto / Elegir de galería)
│  │  ├─ camera.tsx         # Cámara + indicador de nivel
│  │  ├─ measure.tsx        # Pantalla de medición (usa ImageMeasurer)
│  │  └─ results.tsx        # Resultados: cifras, función, curva, ayuda
│  ├─ components/
│  │  ├─ image-measurer.tsx # Corazón de la interacción: puntos, arrastre, auto-detect
│  │  ├─ slope-overlay.tsx  # SVG: polilínea, vértices, etiquetas por tramo
│  │  ├─ function-plot.tsx  # Mini-gráfico de la función (marco matemático)
│  │  ├─ angle-glyph.tsx    # Glifo SVG del ángulo
│  │  ├─ level-indicator.tsx# Nivel por acelerómetro
│  │  ├─ primary-button.tsx
│  │  └─ result-card.tsx
│  ├─ lib/                  # Lógica PURA (sin React) — toda testeada
│  │  ├─ slope.ts           # ángulo/%/m/proporción + interpretación
│  │  ├─ imageMapping.ts    # mapeo toque de pantalla → píxel de imagen (contain)
│  │  ├─ polyline.ts        # segmentos + función lineal por tramos
│  │  ├─ curveFit.ts        # ajuste polinómico por mínimos cuadrados (grado 1-3)
│  │  ├─ edgeSnap.ts        # imantar una guía al borde (mapa de Canny)
│  │  ├─ segmentPick.ts     # elegir el mejor segmento de Hough
│  │  ├─ autoDetect.ts      # pipeline OpenCV (nativo; carga perezosa)
│  │  ├─ types.ts
│  │  └─ __tests__/         # 6 suites de tests (Jest)
│  └─ global.css            # directivas de NativeWind
├─ app.json                 # config de Expo (permisos, plugins, bundle id)
├─ eas.json                 # perfiles de EAS Build
├─ babel.config.js · metro.config.js · tailwind.config.js
└─ package.json
```

---

## Cómo funciona por dentro

Toda la matemática vive en `src/lib/` como **funciones puras** (sin dependencias de React), lo que la
hace fácil de testear y razonar. Las pantallas solo orquestan.

- **`imageMapping.ts` — el punto delicado.** La foto se muestra con `contentFit="contain"` (escala
  uniforme + barras). Convierte el toque (coordenadas de pantalla) a **píxeles reales de la imagen**
  antes de calcular, para que el ángulo sea correcto sea cual sea la relación de aspecto. Los puntos
  se guardan **siempre en píxeles de imagen** (fuente de verdad) y solo se mapean a pantalla para
  dibujar.
- **`slope.ts`.** `atan2` (nunca división → sin errores en vertical), pliega el ángulo a [0, 90],
  y deriva %, número `m = tan θ` y proporción, con guardas para vertical/plano/degenerado. También
  `interpretSlope` (categoría en lenguaje llano).
- **`polyline.ts`.** Descompone la polilínea en tramos y construye la **función lineal por tramos**
  en un marco matemático (x a la derecha, y hacia arriba). Detecta si el trazo no es una función
  (se devuelve en x, o tramo vertical).
- **`curveFit.ts`.** Ajuste polinómico por mínimos cuadrados (ecuaciones normales) con
  **normalización numérica** para ser estable con coordenadas de píxel grandes. Elige el menor grado
  con buen R² (parsimonia).
- **`edgeSnap.ts` + `autoDetect.ts`.** OpenCV genera un mapa de bordes (gris → desenfoque → Canny);
  `edgeSnap` recorre tu guía y "imanta" cada paso al píxel de borde más cercano en perpendicular,
  luego simplifica el trazo (Douglas–Peucker). `autoDetect` es el único módulo que toca código
  nativo y se carga de forma perezosa para no romper Expo Go.

---

## Tests

```bash
npm test           # Jest: 6 suites, ~75 tests de la lógica pura
npx tsc --noEmit   # typecheck
```

Cubren: la matemática de pendiente (incl. vertical/plano), el mapeo de coordenadas (invariancia de
ángulo, ida y vuelta), la función por tramos, el ajuste de curvas (recuperación exacta de
polinomios, estabilidad numérica, elección de grado) y el snap a bordes (contra un bitmap sintético).

**Verificación manual con fotos reales:**
- Fotografía **de frente y nivelado** una línea de ángulo conocido → resultado a ±1–2°.
- La misma línea en **retrato y en paisaje** → mismo ángulo (valida el mapeo).
- Inclina el teléfono ~15° → verás el error de perspectiva que explica la nota de precisión.

---

## Stack tecnológico

- **Expo SDK 57** · React Native 0.86 · React 19
- **expo-router** (navegación por archivos)
- **NativeWind** (Tailwind) para estilos
- **react-native-svg** (dibujo de la polilínea y el gráfico) · **react-native-gesture-handler**
- **expo-camera** · **expo-image-picker** · **expo-image** · **expo-sensors**
- **react-native-fast-opencv** + **expo-image-manipulator** (detección automática; solo build nativo)
- **Jest** (`jest-expo`) para tests

---

## Solución de problemas

- **En Expo Go, "Detectar borde" no hace nada / avisa.** Correcto: OpenCV es nativo y no corre en
  Expo Go. Compila el APK o usa un dev/EAS build.
- **El build de Android agota la RAM / se cierra.** Aplica los límites de `gradle.properties` de la
  sección [Compilar el APK](#compilar-el-apk-de-android-standalone) (arm64, heap reducido).
- **Windows: el build falla con el JDK del PATH.** Usa el JBR de Android Studio como `JAVA_HOME`.
- **Warnings `EBADENGINE` al instalar.** Node algo antiguo (22.12); son solo warnings. Actualiza a
  22.13+ para silenciarlos.
- **La cámara no aparece en el emulador.** Los emuladores no tienen cámara real; usa la galería, o
  un dispositivo físico.

---

## Precisión (importante)

Una foto es una **proyección 2D**: el ángulo medido es el **"ángulo en la imagen"**, que coincide con
la pendiente real **solo si la foto se toma nivelada y de frente** al objeto. Fotos oblicuas o con el
teléfono inclinado introducen error de perspectiva; el indicador de nivel de la cámara ayuda a
mitigarlo. La *forma* de la función es fiel, pero los ángulos absolutos dependen de una buena toma.

---

## Licencia

Ver [LICENSE](LICENSE).
