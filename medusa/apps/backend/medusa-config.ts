import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// Servidor compartilhado (VPS) roda varios projetos Medusa no mesmo Redis.
// TENANT_SLUG prefixa filas/cache/locks para nao colidir entre eles
// (mesmo padrao usado pelo projeto irmao pkvedacoes-medusa).
const TENANT = process.env.TENANT_SLUG || "agricola"

const modules: NonNullable<Parameters<typeof defineConfig>[0]["modules"]> = []

// Imagens de produto no Cloudflare R2 (S3-compatible). Sem isso o Medusa
// guarda upload no disco local do servidor, que nao queremos aqui.
if (process.env.S3_ACCESS_KEY_ID) {
  modules.push({
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        {
          resolve: "@medusajs/file-s3",
          id: "s3",
          options: {
            file_url: process.env.S3_FILE_URL,
            access_key_id: process.env.S3_ACCESS_KEY_ID,
            secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
            region: process.env.S3_REGION,
            bucket: process.env.S3_BUCKET,
            endpoint: process.env.S3_ENDPOINT,
            additional_client_config: {
              forcePathStyle: true,
            },
          },
        },
      ],
    },
  })
}

// Servidor compartilhado (VPS) roda varios projetos Medusa no mesmo Redis.
// TENANT_SLUG prefixa filas/cache/locks para nao colidir entre eles
// (mesmo padrao usado pelo projeto irmao pkvedacoes-medusa).
if (process.env.REDIS_URL) {
  modules.push(
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
        queueName: `${TENANT}-events`,
        workerOptions: { concurrency: 1 },
      },
    },
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
        namespace: `${TENANT}:cache`,
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: { url: process.env.REDIS_URL },
        queueName: `${TENANT}-workflows`,
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            id: "locking-redis",
            resolve: "@medusajs/medusa/locking-redis",
            is_default: true,
            options: {
              redisUrl: process.env.REDIS_URL,
              namespace: `${TENANT}:lock:`,
            },
          },
        ],
      },
    }
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: modules.length ? modules : undefined,
})
