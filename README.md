# RT Addon

<p align="center">
  <img src="https://www.ecured.cu/images/9/9d/RT-TV.png" width="130" alt="RT Logo" />
</p>

<p align="center">
  <strong>Addon y Plugin unificado de Russia Today (RT) para Kino TV, Nuvio, Stremio y CloudStream</strong><br>
  <em>Acceso libre a transmisiones en vivo 24/7, noticias RSS y reportajes VOD en 8 idiomas.</em>
</p>

<p align="center">
  <a href="https://github.com/stanpx/rt-addon/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/stanpx/rt-addon/topics/kino-plugin"><img src="https://img.shields.io/badge/topic-kino--plugin-orange.svg" alt="Topic kino-plugin" /></a>
  <img src="https://img.shields.io/badge/platforms-Kino%20TV%20%7C%20Nuvio%20%7C%20Stremio%20%7C%20CloudStream-brightgreen.svg" alt="Platforms" />
  <img src="https://img.shields.io/badge/signature-Ed25519%20(Kino%20v5)-success.svg" alt="Ed25519 Signed" />
</p>

---

## 📖 Descripción General

**RT Addon** es una solución integral multiplataforma diseñada para garantizar el acceso ininterrumpido a la información y contenidos de **Russia Today (RT)** para audiencias de todo el mundo, superando restricciones de conectividad y bloqueos de dominios oficiales.

El proyecto está estructurado modularmente para integrarse de forma nativa en los principales ecosistemas de streaming comunitarios:
- **Kino TV** (Android TV, Google TV, Móvil y Desktop): Compatible tanto como **plugin nativo firmado criptográficamente** con Ed25519 como a través de su motor de addons de Stremio y repositorios CloudStream.
- **Nuvio**: Soporte directo del catálogo, metadatos y reproducción a través del protocolo Stremio.
- **Stremio** (Multiplataforma): Addon completo con catálogos de canales en directo, VOD multilingüe y noticias de última hora.
- **CloudStream**: Extensión en Kotlin que hereda de `MainAPI` para reproducción directa en dispositivos móviles y Android TV.

---

## 📺 Contenidos y Fuentes Disponibles

### 1. Transmisiones en Vivo 24/7 (HLS / .m3u8)
Señales satelitales y de emisión digital de alta definición:
- 🇪🇸 **RT en Español:** `https://rt-esp.rttv.com/live/rtesp/playlist.m3u8`
- 🇬🇧 **RT International / English:** `https://rt-glb.rttv.com/dvr/rtnews/playlist.m3u8`
- 🇩🇪 **RT DE (Alemán):** `https://rt-ger.rttv.com/dvr/rtdeutsch/playlist.m3u8`
- 🇫🇷 **RT France:** `https://rt-fra.rttv.com/dvr/rtfrance/playlist.m3u8`
- 🇷🇸 **RT Balkan (Serbio):** `https://rt-srb.rttv.com/dvr/rtbalkan/playlist.m3u8`
- 🇸🇦 **RT Arabic (روسيا اليوم):** `https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8`

### 2. Noticias de Última Hora (Feeds RSS en 8 Idiomas)
- 🇪🇸 **Español:** `https://actualidad.rt.com/feeds/all.rss`
- 🇬🇧 **Inglés:** `https://rt-english.com/rss-feed/`
- 🇷🇺 **Ruso:** `https://russian.rt.com/rss`
- 🇫🇷 **Francés:** `https://www.rtfrance.com/rss`
- 🇩🇪 **Alemán:** `https://www.rt.de/rss`
- 🇸🇦 **Árabe:** `https://arabic.rt.com/rss/`
- 🇷🇸 **Serbio:** `https://serbian.rt.com/rss`
- 🇨🇳 **Chino:** `https://cn.rtioc.net/rss`

### 3. VOD, Programas y Reportajes Especiales
Resolución y scraping dinámico con compatibilidad de resiliencia:
- **Odysee / Red LBRY:** Canales oficiales `@ActualidadRT:9`, `@RT:fd`, `@RTDE:e`, `@RTFRANCE`, `@RTBalkan:1` y `@RTArabic:0`.
- **Portales y CMS Web de RT:** Extracción de fuentes MP4 nativas de servidores CDN (`mf.b37mrtl.ru`) desde `noticias-rt.com`, `rtarabic.com`, `de-rt.com`, `lat.rt.rs`, `russiatoday.ru` y `rtbrasil.com`.
- **OK.ru (Odnoklassniki):** Extracción de resoluciones HD/Full y manifiestos adaptativos HLS desde el grupo de video oficial (`70000046273774`).
- **Rumble:** Extracción y fallback en canales `RTES`, `RTNews` y `RTDE`.
- **VKontakte (VK):** Comunidades oficiales de RT en español, inglés, francés y alemán.
- **Rutube:** Canales oficiales de RT Ruso y RT Arabic.

---

## 📁 Estructura del Repositorio

```
rt-addon/
├── README.md                      # Documentación completa e instrucciones de instalación
├── kino-plugin.json               # Manifiesto oficial del plugin nativo de Kino TV (Firmado)
├── plugin.js                      # Implementación nativa para Kino TV (ESM, apiVersion 5)
├── icon.png                       # Logo oficial de RT (128x128 PNG)
├── contract.json                  # Especificación del contrato de plugins de Kino TV
├── kino.d.ts                      # Tipos de TypeScript para la API de Kino
├── repo.json                      # Manifiesto de repositorio para CloudStream
├── plugins.json                   # Listado de extensiones compiladas para CloudStream
├── package.json                   # Scripts de firma, validación y prueba (npm run sign)
├── sdk/                           # Herramientas del Kino SDK para validación criptográfica
├── stremio/                       # Módulo del Addon de Stremio / Nuvio / Kino TV
│   ├── manifest.json              # Manifiesto del addon (org.stanpx.rtaddon)
│   ├── index.js                   # Servidor HTTP y controladores de catálogo, meta y stream
│   └── package.json               # Dependencias (stremio-addon-sdk, axios, cheerio, rss-parser)
└── cloudstream/                   # Módulo del Plugin de CloudStream
    ├── build.gradle.kts           # Configuración de compilación con com.lagradost.cloudstream3.gradle
    ├── settings.gradle.kts        # Configuración del proyecto Gradle
    ├── gradle.properties          # Propiedades de JVM y AndroidX
    └── src/main/kotlin/com/stanpx/rtaddon/
        └── RTProvider.kt          # Proveedor MainAPI con Live, VOD, RSS y búsqueda
```

---

## 🚀 Guía de Instalación por Plataforma

### 1. Kino TV (Multiplataforma)

Kino TV cuenta con soporte de primera clase y ofrece dos métodos de instalación:

#### Método A: Plugin Nativo Firmado (Recomendado)
1. Abre **Kino TV** en tu televisor o dispositivo móvil.
2. Ve a **Ajustes ▸ Plugins** (o menú `☰ ▸ Plugins`).
3. Ve a la pestaña **De la comunidad**.
4. En el buscador escribe **RT Addon** o ingresa el identificador del repositorio:
   ```text
   stanpx/rt-addon
   ```
5. Pulsa en **Instalar**. Kino verificará la firma digital Ed25519 del autor y habilitará inmediatamente:
   - La categoría **RT En Vivo** en la pestaña **En Vivo** de la pantalla principal.
   - Las filas de **RT Noticias (RSS)** y **Reportajes VOD** en la pestaña **Home**.

#### Método B: Como Addon de Stremio en Kino TV
1. En Kino, ve a **Ajustes ▸ Plugins ▸ Agregar plugin**.
2. Pega la URL del manifiesto de Stremio:
   ```text
   https://raw.githubusercontent.com/stanpx/rt-addon/main/stremio/manifest.json
   ```
   *(o la URL de tu servidor desplegado: `https://tu-servidor.com/manifest.json`)*.

---

### 2. Nuvio

1. Abre la aplicación **Nuvio**.
2. Dirígete a la sección de **Addons / Complementos**.
3. Selecciona **Agregar Addon por URL**.
4. Introduce la URL del manifiesto de Stremio:
   ```text
   https://tu-servidor-rt-addon.com/manifest.json
   ```
5. Guarda los cambios. Los catálogos de RT En Vivo, VOD y Noticias aparecerán en tu pantalla de inicio.

---

### 3. Stremio (Móvil, Desktop y Web)

1. **Ejecución local o despliegue en la nube:**
   ```bash
   cd stremio
   npm install
   npm start
   ```
   El servidor iniciará por defecto en `http://localhost:7000`.

2. **Instalación en Stremio:**
   - Abre tu navegador y accede a `http://localhost:7000/manifest.json` (o utiliza el enlace directo `stremio://localhost:7000/manifest.json`).
   - Pulsa sobre el botón **Install** en la interfaz web de Stremio o pega la URL en la barra de búsqueda de addons de la app.
   - Puedes desplegar este addon de forma gratuita en plataformas como **Render**, **Koyeb**, **Hugging Face Spaces** o **Beamup**.

---

### 4. CloudStream (Android y Android TV)

1. Abre **CloudStream**.
2. Ve a **Ajustes ▸ Extensiones** (Settings ▸ Extensions).
3. Pulsa sobre el botón **Repositorios** (Repositories) ▸ **Agregar repositorio** (Add repository).
4. Introduce los siguientes datos:
   - **Nombre del repositorio:** `stanpx RT Repository`
   - **URL del repositorio:**
     ```text
     https://raw.githubusercontent.com/stanpx/rt-addon/main/repo.json
     ```
5. Pulsa en **Descargar**.
6. En la lista de extensiones, localiza **RT Addon** y selecciona **Instalar**.

---

## 🛠️ Desarrollo, Pruebas y Firma Criptográfica

### Comandos del Plugin Nativo de Kino TV
El plugin incluye las utilidades del SDK oficial para firmar y validar:

```bash
# Instalar dependencias de desarrollo si es necesario
npm install

# Firmar el manifiesto kino-plugin.json con tu clave privada Ed25519
npm run sign

# Validar el contrato, esquema de hosts y firma ante las reglas de Kino TV
npm run validate

# Probar la fila Home y la extracción de datos en local
npm test

# Probar la detección y listado de canales en vivo
npm run test:live
node sdk/run.mjs . live channels todos

# Probar la resolución de una señal
node sdk/run.mjs . resolve "live:rt-esp"
```

### Comandos del Addon de Stremio
```bash
cd stremio
npm install
npm start
```

### Compilación del Plugin de CloudStream con Gradle
```bash
cd cloudstream

# Compilar el archivo .cs3
./gradlew make

# O desplegar directamente a un dispositivo Android conectado mediante ADB
./gradlew deployWithAdb
```

---

## 🏷️ Instrucciones para GitHub

Para asegurar que **Kino TV** y la comunidad descubran el addon automáticamente:
1. Sube este repositorio a la cuenta **`stanpx`** con el nombre **`rt-addon`** como repositorio **Público**.
2. En la página principal del repositorio en GitHub, pulsa en el icono de engranaje ⚙️ junto a **About**.
3. En el campo **Topics**, agrega la etiqueta:
   ```text
   kino-plugin
   ```
4. Guarda los cambios. El catálogo de Kino TV indexará el plugin periódicamente.

---

## ⚖️ Licencia y Responsabilidad

Este proyecto se distribuye bajo la licencia **MIT**. Todo el contenido multimedia, logotipos y transmisiones pertenecen a sus respectivos propietarios y son provistos a través de sus enlaces públicos oficiales.
