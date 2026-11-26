import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TEMP_DIR = path.join(ROOT, '.expo-ota-dist')
const DOCS_DIR = path.join(ROOT, 'docs')
const OTA_DIR = path.join(DOCS_DIR, 'ota')

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json'
}

function sha256Base64Url(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('base64url')
}

function deterministicUuid(seedString) {
  const bytes = crypto.createHash('sha256').update(seedString).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// 1. Clean temporary export dir
fs.rmSync(TEMP_DIR, { recursive: true, force: true })

// 2. Run Expo export for Android
console.log('Exporting Android bundle & assets for OTA...')
execSync(`npx expo export --platform android --output-dir .expo-ota-dist --clear`, {
  cwd: ROOT,
  stdio: 'inherit'
})

// 3. Read app.json and exported metadata.json
const appConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const expoConfig = appConfig.expo || {}
const runtimeVersion = String(expoConfig.runtimeVersion || expoConfig.version || '1.0.2')
const metadata = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'metadata.json'), 'utf8'))
const androidMeta = metadata?.fileMetadata?.android
if (!androidMeta?.bundle) {
  throw new Error('Export failed: metadata.json missing fileMetadata.android.bundle')
}

// 4. Replace docs/ota with new export contents
fs.mkdirSync(DOCS_DIR, { recursive: true })
fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '')
fs.rmSync(OTA_DIR, { recursive: true, force: true })
fs.cpSync(TEMP_DIR, OTA_DIR, { recursive: true })
fs.rmSync(path.join(OTA_DIR, 'metadata.json'), { force: true })

// 5. Build Expo Updates v1 JSON manifest (served with expo-protocol-version: 0 interceptor)
const bundleRel = androidMeta.bundle.replace(/\\/g, '/')
const bundleFull = path.join(OTA_DIR, ...bundleRel.split('/'))
const bundleHash = sha256Base64Url(bundleFull)
const bundleBaseName = path.basename(bundleRel, path.extname(bundleRel))
const bundleKey = bundleBaseName.replace(/[^a-zA-Z0-9_-]/g, '_')

const assets = (androidMeta.assets || []).map((a) => {
  const relUrl = a.path.replace(/\\/g, '/')
  const fullPath = path.join(OTA_DIR, ...relUrl.split('/'))
  const ext = String(a.ext || '').replace(/^\./, '').toLowerCase()
  const key = path.basename(relUrl)
  return {
    hash: sha256Base64Url(fullPath),
    key,
    contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
    fileExtension: ext ? `.${ext}` : undefined,
    url: relUrl
  }
})

const hashSeed = `${runtimeVersion}|${bundleHash}|${assets.map((a) => a.hash).join(',')}`
const updateId = deterministicUuid(hashSeed)

const manifest = {
  id: updateId,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: {
    hash: bundleHash,
    key: bundleKey,
    contentType: 'application/javascript',
    fileExtension: path.extname(bundleRel) || '.hbc',
    url: bundleRel
  },
  assets,
  metadata: {},
  extra: {
    scopeKey: 'https://trimzyxd.github.io/aerial-mobile',
    expoClient: {
      name: expoConfig.name,
      slug: expoConfig.slug,
      version: expoConfig.version,
      runtimeVersion,
      orientation: expoConfig.orientation,
      userInterfaceStyle: expoConfig.userInterfaceStyle
    }
  }
}

fs.writeFileSync(path.join(OTA_DIR, 'android.json'), JSON.stringify(manifest, null, 2))

// 6. Clean temporary export directory
fs.rmSync(TEMP_DIR, { recursive: true, force: true })

console.log(`OTA build ready in docs/ota/android.json (id=${updateId}, runtime=${runtimeVersion}, assets=${assets.length})`)
