# Auditoría Técnica Integral y Estrategia de Diferenciación — Fenced

> **Nota de conservación documental:** Este documento conserva íntegramente el inventario previo documentado en [`docs/10-full-audit-and-improvements.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/10-full-audit-and-improvements.md#L1-L86) y su historial de reconciliación ([`docs/design_audit.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/design_audit.md#L1-L265), commits `4c7f669`, `d94f93a`, `49d8bf2`), marcando explícitamente como **✅ Resuelto** aquello que ya fue corregido en el código actual y ampliándolo con la auditoría desde cero de todo el monorepo (`apps/api`, `apps/mobile`, `packages/*`, `native/*`) y el estudio estratégico de mercado.

---

## 1. Resumen ejecutivo

**Fenced** cuenta con una arquitectura local-first madura (cola outbox idempotente, máquina de sesiones por reloj de pared, parser NLP trilingüe `en`/`es`/`ca`, empaquetador determinista de bloques y diseño ético COPPA/GDPR-K sin *dark patterns*). Sin embargo, existen **dos bloqueos críticos de lanzamiento y cumplimiento legal**: (1) el paquete nativo [`native/fenced-blocking/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/native/fenced-blocking/src/index.ts#L1-L306) sigue siendo 100 % un *stub* en TypeScript sin extensiones Swift (`FamilyControls`) ni Kotlin (`UsageStatsManager`), por lo que la app aún no bloquea aplicaciones reales en el sistema operativo; y (2) dos vulnerabilidades críticas en el backend reactivan automáticamente el consentimiento parental revocado tras 30 días ([`retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts#L10-L19)) y permiten a cuentas `child` auto-escalar a `adult` desbloqueando IA y telemetría ([`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L217-L236)). En calidad, seguridad y escalabilidad destacan además referencias cruzadas sin validar propietario (IDOR), ausencia de limpieza local al cerrar sesión ([`auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx#L147-L150)), llamadas remotas a Supabase por cada request ([`auth.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/auth.ts#L55)), bucles N+1 en Google Calendar ([`calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/calendar-sync.ts#L301-L457)) y *stores* en memoria incompatibles con múltiples instancias. Estratégicamente, el código ya contiene en [`packages/core/src/`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/index.ts#L1-L15) siete motores diferenciales (`load-score`, `gravity`, `energy`, `yard`, `co-focus`, `class-rules`, `pact`) completamente probados pero aún desconectados de la interfaz móvil, que permiten posicionar a Fenced en el hueco exacto entre los planificadores ejecutivos caros ($16–$34/mes) y los bloqueadores punitivos ($40–$100/año).

---

## 2. Hallazgos de seguridad

### 2.1 Estado de hallazgos previos documentados (Conservación y Reconciliación)

| ID Previo | Descripción original en auditoría previa | Estado actual | Evidencia en código real |
|---|---|---|---|
| **HIST-S1** | Inyección de cabeceras CRLF en exportación iCal (`packages/ical`) | **✅ Resuelto** | [`packages/ical/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ical/src/index.ts#L51-L65) sanitiza saltos `\r\n` en `escapeText` y valida `rrule` mediante ` sanitizeRrule()` ([`packages/ical/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ical/src/index.ts#L68-L76)). |
| **HIST-S2** | Estado OAuth (`state`) de Google Calendar sin protección anti-replay de un solo uso | **✅ Resuelto (parcial: memoria local)** | [`apps/api/src/integrations/oauth-state.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/oauth-state.ts#L50-L60) incorpora `nonce` aleatorio de 96 bits y `consumedNonces` con firma HMAC-SHA256 (`timingSafeEqual` en [`oauth-state.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/oauth-state.ts#L105-L120)). *(Pendiente migrar `consumedNonces` a Redis/BD en multi-instancia).* |
| **HIST-S3** | Comparación no constante de secretos en endpoints `/jobs/*` y `/webhooks/vpc` | **✅ Resuelto** | [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L22-L37) implementa `safeCompare()` y `verifyHmacSignature()` usando `crypto.timingSafeEqual`. |
| **HIST-S4** | Fuga de información de otros usuarios en el endpoint de salud `/health` | **✅ Resuelto** | [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L69-L79) ejecuta únicamente `SELECT 1` y devuelve `{ status, db }` sin exponer datos de usuarios. |
| **HIST-S5** | Redacción incompleta de PII antes de invocar modelos LLM (`packages/ai`) | **✅ Resuelto** | [`packages/ai/src/redact.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ai/src/redact.ts#L7-L38) redacta emails, teléfonos internacionales, SSN, direcciones postales, URLs y `@handles`, truncando a `MAX_TEXT_LENGTH = 500`. |
| **HIST-S6** | Degradación silenciosa de banda de edad (`adult` → `child`) desde cliente | **✅ Resuelto (para *downgrade*)** | [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L211-L215) bloquea toda reducción de banda de edad (`RANK[input.ageBand] < RANK[current.ageBand]`). *(Ver SEC-02 para el bug inverso en escalada).* |
| **HIST-S7** | Condición de carrera en creación concurrente de perfil (`ensureProfile`) | **✅ Resuelto** | [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L153-L169) utiliza `.onConflictDoNothing({ target: users.clerkId })` y re-consulta la fila ganadora ([`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L170-L176)). |

---

### 2.2 Nuevos hallazgos de seguridad y cumplimiento (Fase 1.1)

#### Severidad CRÍTICA

* **SEC-01 [CRÍTICA — ✅ RESUELTO] — El job de retención reactiva automáticamente el consentimiento parental revocado a los 30 días (Bypass COPPA / GDPR-K)**
  * **Solución aplicada:** Se reescribió [`apps/api/src/jobs/retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts). Las filas de `consent_events` son ahora estrictamente append-only (nunca se borran). Tras 30 días de revocación sin nuevo consentimiento activo, el job purga atómicamente todos los datos personales sincronizados del usuario (`tasks`, `taskDependencies`, `sessions`, `fencedHours`, `fences`, `projects`, `calendarEvents`, `calendarSyncTombstones`, `calendarConnections`, `calendarFeeds`, `streaks`) y anonimiza el perfil en `users`.
  * **Evidencia:** [`apps/api/src/jobs/retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts#L10-L19) y [`apps/api/src/consent.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/consent.ts#L20-L35).
  * **Detalle técnico:** `enforceRetention()` ejecuta `DELETE FROM consent_events WHERE revoked_at IS NOT NULL AND revoked_at < cutoff` (30 días). Sin embargo, `activeConsent()` en [`consent.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/consent.ts#L24-L34) determina si un menor tiene permiso parental consultando únicamente el último evento por fecha (`ORDER BY created_at DESC LIMIT 1`) y evaluando `Boolean(latest?.grantedAt && !latest.revokedAt)`. Cuando el evento de revocación se borra a los 30 días, el evento previo con `grantedAt != null` vuelve a quedar como el más reciente, **reactivando el consentimiento parental revocado** sin intervención del tutor. Además, contradice el diseño de registro de auditoría inmutable (*append-only*) documentado en [`docs/04-tech-stack.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/04-tech-stack.md#L231) y no purga los datos reales de cuentas inactivas.
  * **Impacto:** Violación directa de COPPA (16 CFR § 312.6) y GDPR Art. 7(3)/8, además de destrucción de pruebas de auditoría regulatoria.
  * **Remediación:** Nunca eliminar filas de `consent_events`; mantener el log estrictamente *append-only*. Si tras 30 días de revocación el tutor no ha vuelto a otorgar consentimiento, el job debe eliminar los datos sincronizados del menor (`tasks`, `sessions`, `calendar_events`, `fences`, `fenced_hours`) o la cuenta, preservando la traza anonimizada de consentimiento.

* **SEC-02 [CRÍTICA — ✅ RESUELTO] — Escalada de privilegios de `child` a `adult` con consentimiento parental básico y bloqueo permanente de `teen` → `adult`**
  * **Solución aplicada:** En [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L220-L235) y [`apps/api/src/consent.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/consent.ts), la mutación `updateAgeBand` ahora verifica estrictamente el `scope` del consentimiento verificado. Un menor con consentimiento estándar `coppa-account` tiene prohibido escalar a `adult`; solo se permiten eventos dedicados con `scope` `"age-band-escalation"`, `"age-band-correction"` o `"verified-adult"`.
  * **Evidencia:** [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L217-L236) y [`packages/policy/src/feature-access.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/policy/src/feature-access.ts#L67-L78).
  * **Detalle técnico:** En `user.updateAgeBand`, cuando un usuario intenta escalar de `child` a `adult`, el servidor verifica únicamente `const hasConsent = await activeConsent(ctx.db, ctx.userId)`. Pero todo usuario `child` que puede llamar a `authedProcedure` ([`apps/api/src/trpc/init.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/init.ts#L45-L60)) **ya tiene** un evento `activeConsent` (otorgado por su tutor para usar la cuenta infantil con `scope: "coppa-account"` o `"full"` en [`app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L225)). Como `activeConsent` no distingue el `scope` de un consentimiento de uso infantil frente a una verificación de mayoría de edad, cualquier niño con cuenta aprobada puede invocar `user.updateAgeBand({ ageBand: "adult", assuranceMethod: "neutral-screen" })` y desbloquear inmediatamente todas las funciones `NEVER_FOR_MINOR` (`llm-parsing`, `llm-planning-chat`, `calendar-feed-publish`, `product-analytics`). En sentido opuesto, un usuario `teen` nunca genera filas en `consent_events` (`requiresParentalConsent("teen")` es `false` en [`feature-access.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/policy/src/feature-access.ts#L107-L109)), por lo que al cumplir 18 años `activeConsent` devuelve `false` y jamás puede pasar a `adult`.
  * **Remediación:** Separar el alcance (`scope`) en `consent_events`: exigir un evento específico `scope = "age-band-correction"` verificado por el tutor (o prueba de edad verificada) para corregir `child` → `teen`/`adult`, y permitir la transición natural de mayoría de edad bajo verificación independiente.

#### Severidad ALTA

* **SEC-03 [ALTA — ✅ RESUELTO] — Referencias cruzadas entre usuarios (Cross-Tenant IDOR) y ciclos infinitos en `task`, `session` y `calendar`**
  * **Solución aplicada:** Añadida validación estricta de aislamiento multitenant en [`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts) (`projectId` y `parentTaskId` con detección de ciclos y límite de 3 niveles en `create` y `update`), en [`session.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/session.ts) (`linkedTaskId` verificado para pertenecer a `ctx.userId`) y en [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts) (`linkedTaskId` y `linkedSessionId` verificados).
  * **Evidencia:**
    * [`apps/api/src/trpc/routers/task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L34-L88) (`create`) y [`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L108-L135) (`update`).
    * [`apps/api/src/trpc/routers/session.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/session.ts#L59-L97) (`create`).
    * [`apps/api/src/trpc/routers/calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L70-L103) (`create`) y [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L124-L148) (`update`).
  * **Detalle técnico:**
    1. `task.create` y `task.update` insertan/actualizan `projectId` sin comprobar que el proyecto pertenezca a `ctx.userId`.
    2. `task.update` ([`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L108)) permite modificar `parentTaskId` sin verificar que la tarea padre pertenezca a `ctx.userId`, sin validar `parentTaskId !== input.id` (auto-referencia) y sin aplicar el límite de profundidad de 3 niveles que sí existe en `task.create` ([`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L42-L66)).
    3. `session.create` ([`session.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/session.ts#L59)) valida que `fenceId` sea del usuario ([`session.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/session.ts#L67-L78)), pero no verifica que `linkedTaskId` pertenezca a `ctx.userId`.
    4. `calendar.create` y `calendar.update` no validan que `linkedSessionId` ni `linkedTaskId` pertenezcan a `ctx.userId`.
  * **Impacto:** Un atacante autenticado puede sondear UUIDs ajenos mediante errores de clave foránea PostgreSQL (oráculo de existencia de IDs de otros tenants) y corromper grafos de subtareas.

* **SEC-04 [ALTA — ✅ RESUELTO] — Ausencia de borrado de datos locales al cerrar sesión (`signOut`) provoca fuga y contaminación entre cuentas**
  * **Solución aplicada:** [`apps/mobile/src/lib/auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx) ahora invoca `await resetAppState()`, `await resetOnboarding()` y vacía el outbox tanto en Supabase como en el modo Dev.
  * **Evidencia:** [`apps/mobile/src/lib/auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx#L147-L150), [`apps/mobile/src/lib/onboarding-state.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/onboarding-state.ts#L193-L197) y [`apps/mobile/app/(tabs)/you.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/you.tsx#L184-L191).
  * **Detalle técnico:** Al pulsar *"Sign out"*, `auth.signOut()` únicamente invoca `client.auth.signOut()` y `markSignedOut()` (que solo cambia `signedIn: false`). **No** llama a `resetAppState()` ([`local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L393-L405)), ni a `clearOutbox()`, ni a `resetOnboarding()`, ni elimina la caché `fenced.ai.weeklyCoach.v1` ([`insights.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/insights.tsx#L21)). Si otro usuario inicia sesión en el mismo dispositivo (p. ej., tablet familiar o escolar), `SyncBootstrap` ([`bootstrap.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/bootstrap.tsx#L44-L53)) ejecuta `fullSync()` y vuelca las tareas locales y operaciones pendientes del Usuario A en la cuenta en la nube del Usuario B.

* **SEC-05 [ALTA — ✅ RESUELTO] — Tokens de sesión de Supabase almacenados en `AsyncStorage` sin cifrar**
  * **Solución aplicada:** En [`apps/mobile/src/lib/auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx), se implementó un adaptador seguro de almacenamiento usando `expo-secure-store` en Android e iOS, garantizando cifrado en reposo para tokens JWT y de refresco.
  * **Evidencia:** [`apps/mobile/src/lib/auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx#L44-L54).
  * **Detalle técnico:** A pesar de que `expo-secure-store` está instalado en [`apps/mobile/package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/package.json#L38), el cliente de Supabase se inicializa con `storage: AsyncStorage` (reconocido con un comentario `// shortcut: session tokens live in AsyncStorage (unencrypted)` en la línea 54). En Android/iOS con backup o acceso físico comprometido, los JWT y `refresh_token` quedan expuestos en texto plano en SQLite/plist.

* **SEC-06 [ALTA — ✅ RESUELTO] — Política CORS comodín (`*`) global y ausencia de límites de tamaño en arrays/cadenas de entrada**
  * **Solución aplicada:** Se sustituyó el comodín en [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts) por una lista blanca configurable (`ALLOWED_ORIGINS` con fallback seguro para localhost y orígenes nativos). Se agregaron límites Zod `.max()` en `appTokens` (500), `categoryTokens` (100) en [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts) y `reminders` (10) en [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts).
  * **Evidencia:** [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L65), [`apps/api/src/trpc/routers/fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L18-L19) y [`apps/api/src/trpc/routers/calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L64-L69).
  * **Detalle técnico:**
    1. `app.use("*", cors())` en [`app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L65) emite `Access-Control-Allow-Origin: *` para todas las rutas sin lista blanca de dominios (`ALLOWED_ORIGINS`).
    2. No hay middleware `bodyLimit` en Hono antes de `/trpc/*`.
    3. En [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L18-L19) y [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L49-L50), `appTokens: z.array(z.string())` y `categoryTokens: z.array(z.string())` carecen de `.max()` tanto en longitud de array como de string, permitiendo inyectar payloads JSON de decenas de megabytes en columnas JSONB. Lo mismo ocurre en [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L64-L69) y [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L118-L123) para `notes: z.string()`, `rrule: z.string()` y `reminders: z.array(z.number().int())`.

#### Severidad MEDIA

* **SEC-07 [MEDIA — ✅ PARCIALMENTE RESUELTO (Atomicidad de BD)] — Webhook VPC (`/webhooks/vpc`) sin transacción atómica y flujo de solicitud de consentimiento simulado**
  * **Solución aplicada:** En [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts), la inserción en `consentEvents` y la actualización de `users.needsGuardianConsent` se envolvieron en `db.transaction()` garantizando atomicidad completa y evitando estados inconsistentes ante fallos de base de datos.
  * **Evidencia:** [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L197-L235) y [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L160-L169), [`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L260-L279).
  * **Detalle técnico:**
    1. En `/webhooks/vpc`, la inserción en `consentEvents` (líneas 217–226) y el `UPDATE` sobre `users.needsGuardianConsent` (líneas 228–235) se ejecutan fuera de `db.transaction()`. Si el `UPDATE` falla tras el `INSERT`, cualquier reintento del proveedor VPC chocará contra el índice único `consent_events_vendor_ref_uidx` y recibirá `409 Duplicate webhook event` ([`app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L200-L202)), dejando la cuenta bloqueada o con `needsGuardianConsent = false` pese a una revocación.
    2. Tanto `ensureProfile` como `resendGuardianConsent` insertan un evento `"email-notice"` en BD con una referencia local `notice:${ctx.userId}:${Date.now()}`, pero **no envían ningún correo real ni llaman a la API de ningún proveedor VPC** (Kids Web Services / PRIVO).

* **SEC-08 [MEDIA] — Bypass de autenticación `Bearer dev:<userId>` activo en cualquier entorno donde `NODE_ENV !== "production"`**
  * **Evidencia:** [`apps/api/src/auth.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/auth.ts#L34-L46).
  * **Detalle técnico:** `isProduction()` comprueba únicamente `NODE_ENV === "production" || VERCEL_ENV === "production"`. En despliegues de *staging*, *preview* o contenedores mal configurados donde `NODE_ENV` sea `"staging"` o `"development"`, cualquier cliente puede suplantar a cualquier usuario enviando `Authorization: Bearer dev:<clerkId>` sin necesidad de JWT válido. Debe requerir una bandera explícita `ALLOW_DEV_AUTH=true` y rechazarse por defecto.

* **SEC-09 [MEDIA — ✅ RESUELTO] — Sanitización HTML mediante regex `/<[^>]*>/g` incompleta y destructiva para texto legítimo**
  * **Solución aplicada:** Se eliminó la expresión regular destructiva en [`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts), [`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts), [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts) y [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts), sustituyéndola por una sanitización que neutraliza bytes nulos (`\0`) y limpia espacios sin corromper operadores matemáticos (`<`, `>`) ni código legítimo.
  * **Evidencia:** Duplicada en 6 routers: [`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L25-L27), [`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L6-L8), [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L6-L8), [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L15-L17), [`fenced-hours.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fenced-hours.ts#L11-L13) y [`project.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/project.ts#L10-L12).
  * **Detalle técnico:** La expresión `val.replace(/<[^>]*>/g, "")` no elimina etiquetas HTML malformadas sin `>` de cierre (p. ej. `<img src=x onerror=...`) y, en cambio, **destruye notas de estudio o código** legítimas de estudiantes cuando contienen operadores matemáticos menores y mayores en la misma nota (ej. `"Estudiar si x < 5 y y > 2"` se transforma silenciosamente en `"Estudiar si x  2"`). Al renderizarse en componentes `<Text>` nativos de React Native (que no interpretan HTML), esta mutación destructiva en base de datos es innecesaria y contraproducente.

* **SEC-10 [MEDIA] — Corrección de banda de edad en móvil (`app/profile/age-band.tsx`) no sincroniza con el servidor**
  * **Evidencia:** [`apps/mobile/app/profile/age-band.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/age-band.tsx#L34-L45), [`apps/mobile/src/lib/sync/profile.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/profile.ts#L46-L59) y [`apps/api/src/trpc/routers/user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L132-L151).
  * **Detalle técnico:** `AgeBandScreen` llama a `pushOnboardingProfile()`, que invoca `client.user.ensureProfile.mutate(...)`. Sin embargo, cuando el usuario ya existe en la base de datos, `ensureProfile` ignora deliberadamente `input.ageBand` (solo actualiza nombre, email, zona horaria e intent) porque los cambios de edad deben ir por `user.updateAgeBand`. Como resultado, si un adulto corrige su edad a menor en `age-band.tsx`, el móvil muestra `"TEEN"` o `"CHILD"` pero el servidor mantiene `ageBand = "adult"`, creando una divergencia de cumplimiento entre cliente y servidor.

#### Severidad BAJA

* **SEC-11 [BAJA] — Exposición de `stack` en `errorFormatter` de tRPC fuera de producción**
  * **Evidencia:** [`apps/api/src/trpc/init.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/init.ts#L8-L18).
  * **Detalle técnico:** Aunque el mensaje de `INTERNAL_SERVER_ERROR` se sustituye por `"Internal server error"`, `data: { ...shape.data, zodError: ... }` conserva `shape.data.stack` de tRPC cuando `isProduction()` es `false`.

* **SEC-12 [BAJA] — Ausencia de cabeceras HTTP de seguridad en respuestas HTML del callback OAuth**
  * **Evidencia:** [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L45-L61) y [`app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L125-L173).
  * **Detalle técnico:** El endpoint `GET /oauth/google/callback` devuelve páginas HTML con `meta http-equiv="refresh"` sin cabeceras `Content-Security-Policy`, `X-Content-Type-Options: nosniff` ni `Referrer-Policy: no-referrer` (importante dado que la URL contiene `?code=...`).

---

## 3. Mejoras de código y rendimiento

### 3.1 Estado de bloqueos y hallazgos previos (P0–P3)

Conservamos y actualizamos el estado de los hallazgos documentados previamente en [`docs/10-full-audit-and-improvements.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/10-full-audit-and-improvements.md#L15-L78) y [`docs/design_audit.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/design_audit.md#L1-L265):

1. **[P0 — ABIERTA] Bloqueo nativo de sistema operativo (`native/fenced-blocking`) es 100 % un *stub* en TypeScript:**
   * **Evidencia:** [`native/fenced-blocking/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/native/fenced-blocking/src/index.ts#L1-L306).
   * **Estado:** Aunque [`apps/mobile/app.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app.json#L15-L51) declara los permisos (`com.apple.developer.family-controls`, `PACKAGE_USAGE_STATS`, `SYSTEM_ALERT_WINDOW`, `@bacons/apple-targets`), no existe ningún archivo `.swift`, `.kt`, `expo-module.config.json` ni carpeta `targets/`. `FencedBlocking` opera siempre en modo `sandbox` (`isSandbox() === true` en [`native/fenced-blocking/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/native/fenced-blocking/src/index.ts#L180-L182)). Además, `appleTeamId` sigue con el placeholder `"YOUR_APPLE_TEAM_ID"` en [`apps/mobile/app.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app.json#L13).
2. **[P0 — ABIERTA] *Fenced Hours* programadas no activan el escudo automáticamente:**
   * **Evidencia:** [`apps/mobile/app/fence-hub.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/fence-hub.tsx#L52-L54) y [`apps/mobile/src/lib/session-runtime.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/session-runtime.tsx#L16-L62).
   * **Estado:** La pantalla `fence-hub.tsx` promete *"Recurring blocks when your fence goes up automatically"*, pero `fencedHours` solo pinta píldoras en `Today` ([`index.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/index.tsx#L156-L169)) y líneas en `Calendar` ([`calendar.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/calendar.tsx#L164-L175)). Ni `SessionRuntime` ni `FencedBlocking` monitorizan ni levantan el escudo cuando llega la hora programada.
3. **[P1 — ABIERTA] Telemetría PostHog y Sentry son *wrappers* vacíos (`console.log` / `console.warn`):**
   * **Evidencia:** [`apps/mobile/src/lib/analytics.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/analytics.ts#L24-L50) y [`apps/mobile/src/lib/sentry.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sentry.ts#L4-L16).
   * **Estado:** La compuerta de edad (`canAccess("product-analytics", ageBand)`) está bien aplicada, pero no hay SDK de PostHog ni de `@sentry/react-native` instalados en [`apps/mobile/package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/package.json#L17-L51) ni en [`apps/api/package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/package.json#L13-L22).
4. **[P1 — ✅ RESUELTO] Degradación de llamadas IA cuando `ANTHROPIC_API_KEY` no está configurada:**
   * **Evidencia:** [`apps/api/src/ai-runtime.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/ai-runtime.ts#L24-L47) y [`packages/ai/src/generate.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ai/src/generate.ts#L50-L185).
   * **Estado:** **✅ Resuelto.** Cuando no hay `ANTHROPIC_API_KEY`, `getAnthropicGenerate()` devuelve `null` y `packages/ai` aplica *fallbacks* deterministas completos (`deterministicParseFallback`, `deterministicReplanAdvice`, `deterministicWeeklyCoach`, `deterministicPlanningReply`).
5. **[P2 — ✅ RESUELTO] Persistencia del índice de ocurrencia (`occurrenceIndex`) en tareas recurrentes con `COUNT`:**
   * **Evidencia:** [`apps/mobile/src/lib/local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L35), [`local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L277) y [`local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L499-L513).
   * **Estado:** **✅ Resuelto en el store local** (`toggleTask` incrementa `occurrenceIndex: currentOccurrence + 1` y detiene la recurrencia al alcanzar `COUNT`). *(Nota: falta añadir la columna `occurrence_index` en [`apps/api/src/db/schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L179-L218) para que no se pierda al sincronizar entre dispositivos).*
6. **[P2 — ✅ RESUELTO] Cuarentena de JSON corrupto en `hydrateAppState()`:**
   * **Evidencia:** [`apps/mobile/src/lib/local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L378-L385).
   * **Estado:** **✅ Resuelto.** Si `JSON.parse(raw)` falla, el payload corrupto se guarda en `fenced.app.corrupt.<timestamp>` antes de restaurar `defaults`.
7. **[P2 — ✅ RESUELTO] Deduplicación de entidades en vuelo (`pendingCreates`) durante `mergeRemote`:**
   * **Evidencia:** [`apps/mobile/src/lib/sync/merge.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/merge.ts#L20), [`merge.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/merge.ts#L66-L72) y [`apps/mobile/src/lib/sync/outbox.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/outbox.ts#L98-L106).
   * **Estado:** **✅ Resuelto.**
8. **[P2 — ✅ RESUELTO] Soporte multi-idioma (`en`, `es`, `ca`) en el parser NLP:**
   * **Evidencia:** [`packages/nlp/src/datetime.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/nlp/src/datetime.ts#L5-L30) y [`apps/mobile/src/lib/locale.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/locale.ts#L8-L20).
   * **Estado:** **✅ Resuelto** para fechas DD/MM vs MM/DD. *(Pendiente extender vocabulario en español/catalán para palabras clave como `"mañana"`, `"cada lunes"` en [`packages/nlp/src/recurrence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/nlp/src/recurrence.ts#L1-L90)).*
9. **[P2 — ✅ RESUELTO] Runtime raíz de sesiones (`SessionRuntime`) y gesto de arrastre en `BottomSheetModal`:**
   * **Evidencia:** [`apps/mobile/src/lib/session-runtime.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/session-runtime.tsx#L16-L62), [`apps/mobile/app/_layout.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/_layout.tsx#L52) y [`apps/mobile/src/components/ui/primitives.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/components/ui/primitives.tsx#L353-L366).
   * **Estado:** **✅ Resuelto.**

---

### 3.2 Nuevos hallazgos de Calidad de Código (Fase 1.2)

1. **Bug funcional en `PlanningChatScreen`: se descartan las preferencias sugeridas por la IA al navegar a `TimeBlockScreen`**
   * **Evidencia:** [`apps/mobile/app/planning-chat.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/planning-chat.tsx#L74-L83) y [`apps/mobile/app/time-block.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/time-block.tsx#L38-L39).
   * **Detalle:** `applyProposeTool()` llama a `proposeScheduleWithAdvice(lastReply.suggestedHorizon ?? "today", lastReply.softPreferences)` sin guardar su retorno y ejecuta `router.push("/time-block")` sin pasar parámetros. Al abrirse `TimeBlockScreen`, `horizon` se inicializa siempre en `"today"` y `softPrefs` en `null`, por lo que la sugerencia del chat de planificación se pierde por completo.

2. **Pantalla de Notificaciones (`app/profile/notifications.tsx`) es 100 % decorativa (código muerto funcional)**
   * **Evidencia:** [`apps/mobile/app/profile/notifications.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/notifications.tsx#L16-L23) y [`apps/mobile/package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/package.json#L17-L51).
   * **Detalle:** Los 4 interruptores (`sessionReminders`, `streakAlerts`, `scheduledHoursAlerts`, `dailySummary`) solo mutan `state.settings.notifications` en `AsyncStorage`. `expo-notifications` no está instalado y ningún módulo programa notificaciones locales ni remotas.

3. **Siete motores de dominio en `@fenced/core` y `computeReachMap` están desconectados de la UI (Código huérfano de alto valor)**
   * **Evidencia:** [`apps/mobile/src/lib/stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L1-L19), [`stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L184-L222) y [`packages/core/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/index.ts#L1-L15).
   * **Detalle:** `calculateLoadScore`, `planDeadlineGravity`, `computeYardProgression`, `computeEnergyCurve`, `validatePactCompliance`, `co-focus.ts`, `class-rules.ts` y `computeReachMap` están implementados y tienen tests unitarios, pero ninguna pantalla de `apps/mobile/app` ni ningún router de `apps/api` los invoca.

4. **Integridad referencial incompleta en el esquema Drizzle (`onDelete` ausente en claves foráneas)**
   * **Evidencia:** [`apps/api/src/db/schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L111-L112), [`schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L166-L190) y [`schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L217-L218).
   * **Detalle:** Las columnas `sessions.fenceId` (L111), `sessions.linkedTaskId` (L112), `fencedHours.fenceId` (L166), `tasks.projectId` (L190), `tasks.parentTaskId` (L217-L218), `calendarEvents.linkedSessionId` (L247) y `calendarEvents.linkedTaskId` (L248) definen `.references(...)` **sin especificar `{ onDelete: "set null" }` o `{ onDelete: "cascade" }`**. Хотя los routers hacen limpiezas manuales parciales (ej. [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L92-L131)), en [`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L152-L159) `task.delete` borra directamente la tarea sin desasociar `sessions.linkedTaskId`, `calendarEvents.linkedTaskId` ni subtareas hijas (`tasks.parentTaskId`), lo que provoca un **error 500 por violación de clave foránea en PostgreSQL** al intentar borrar cualquier tarea que haya tenido una sesión de foco o un bloque de calendario vinculado.

5. **Operaciones multi-paso sin transacción en `calendar.delete`, `fence.delete` y `calendarSync.selectCalendar`**
   * **Evidencia:**
     * [`apps/api/src/trpc/routers/calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L154-L162): Borra primero `calendarEvents` y luego inserta en `calendarEventTombstones` fuera de una transacción. Si el segundo paso falla, el evento nunca se borrará de Google Calendar y reaparecerá en el siguiente pull.
     * [`apps/api/src/trpc/routers/calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar-sync.ts#L146-L172): `selectCalendar` cambia `externalCalendarId` y resetea `syncToken = null`, pero no limpia los eventos ni tombstones del calendario anterior (a diferencia de `disconnect` en [`calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar-sync.ts#L174-L202)), mezclando eventos de dos calendarios distintos bajo el mismo `connectionId`.
     * [`apps/api/src/trpc/routers/fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L92-L131): Reasigna `sessions`, `fencedHours` y promueve nuevo default en 5 queries sueltas sin `ctx.db.transaction()`.

6. **Ausencia de Linter y huecos de cobertura de tests**
   * **Evidencia:** [`package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/package.json#L12) y [`apps/mobile/package.json`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/package.json#L11) (`"lint": "echo 'no linter configured'"`).
   * **Cobertura actual:** Existen 25 archivos de test (`tsx --test`) con excelente cobertura de algoritmos puros (`packages/core`, `packages/nlp`, `packages/ical`, `packages/policy`, `packages/ai`, `sync/merge`, `sync/outbox-core`, `session-engine`, `token-crypto`, `oauth-state`).
   * **Huecos críticos sin tests:**
     * Cero tests de integración sobre los 9 routers tRPC en [`apps/api/src/trpc/routers/`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/index.ts#L1-L26) (`user`, `task`, `session`, `fence`, `fenced-hours`, `project`, `calendar`, `calendar-sync`, `ai`).
     * Cero tests para los jobs [`retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts#L1-L24) y [`streak-rollover.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/streak-rollover.ts#L1-L39) (lo que explica por qué SEC-01 pasó desapercibido).
     * Cero tests de componentes o pantallas React Native en `apps/mobile/app/`.

---

### 3.3 Rendimiento (Base de datos, Backend y Mobile — Fase 1.3)

1. **Verificación de autenticación mediante llamada HTTP remota a Supabase en cada petición (`auth.ts`)**
   * **Evidencia:** [`apps/api/src/auth.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/auth.ts#L55).
   * **Detalle:** `verifyBearerToken` invoca `supabase.auth.getUser(token)` en cada request al API. Esto realiza un *round-trip* de red saliente hacia `*.supabase.co/auth/v1/user` (+50–150 ms por llamada) en lugar de verificar localmente la firma del JWT con el JWKS de Supabase (`jose`).

2. **Consulta adicional a base de datos en cada request tRPC (`createContext`)**
   * **Evidencia:** [`apps/api/src/trpc/context.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/context.ts#L22-L31) y [`apps/api/src/trpc/init.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/init.ts#L45-L60).
   * **Detalle:** `createContext` ejecuta `SELECT id, age_band, needs_guardian_consent FROM users WHERE clerk_id = ? LIMIT 1` en cada llamada HTTP. Además, si el usuario es `"child"`, `authedProcedure` en [`init.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/init.ts#L50) ejecuta una segunda query en `activeConsent(ctx.db, ctx.userId)`.

3. **Consultas N+1 y llamadas HTTP secuenciales sin timeout en sincronización de Google Calendar**
   * **Evidencia:** [`apps/api/src/integrations/calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/calendar-sync.ts#L301-L305), [`calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/calendar-sync.ts#L391-L457) y [`apps/api/src/integrations/google-calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/google-calendar.ts#L147-L225).
   * **Detalle:**
     * En `pullConnection` (L301–305), los eventos modificados (`toUpdate`) se actualizan con un `await db.update(calendarEvents)...` dentro de un bucle `for` individual (N+1 writes).
     * En `pushConnection` (L391–457), se procesan hasta 200 tombstones y 200 eventos locales haciendo `await google.upsertEvent` / `await google.deleteEvent` y `await db.update(...)` de forma estrictamente secuencial.
     * En `google-calendar.ts` (L147–225), ninguna llamada `fetch` a `googleapis.com` u `oauth2.googleapis.com` define `signal: AbortSignal.timeout(10_000)`.

4. **Escaneo costoso del catálogo `pg_timezone_names` en `streak-rollover.ts`**
   * **Evidencia:** [`apps/api/src/jobs/streak-rollover.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/streak-rollover.ts#L21).
   * **Detalle:** La cláusula `CASE WHEN timezone IN (SELECT name FROM pg_timezone_names) ...` evalúa la vista de sistema `pg_timezone_names` (que en PostgreSQL calcula zonas dinámicamente y es notoriamente lenta, ~100–300 ms por ejecución). Ya que `user.ts` valida la zona horaria con `Intl.supportedValuesOf("timeZone")` al guardarla ([`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L33-L45)), basta validar en la capa de aplicación o usar una función SQL inmune a fallos.

5. **Índices compuestos faltantes en PostgreSQL (`schema.ts`)**
   * **Evidencia:** [`apps/api/src/db/schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L67-L95), [`schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L103-L129) y [`schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L209-L214).
   * **Detalle:**
     * `consent_events`: `activeConsent()` filtra por `user_id` y ordena por `created_at DESC LIMIT 1` ([`consent.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/consent.ts#L24-L28)), pero solo existe `consent_events_user_idx(user_id)`. Debe ser compuesto `(user_id, created_at DESC)`.
     * `sessions`: `session.list` y `streak-rollover.ts` filtran por `(user_id, status, completed_at)` o ordenan por `(user_id, created_at DESC)`, pero solo existe `sessions_user_idx(user_id)`.
     * `tasks`: `task.list` ordena por `(user_id, created_at DESC)` ([`task.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/task.ts#L22-L26)), pero solo existen `(user_id, due_at)` y `(user_id, completed_at)`.

6. **Serialización completa del estado en `AsyncStorage` y renders por segundo en móvil**
   * **Evidencia:** [`apps/mobile/src/lib/local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L211-L218) y [`apps/mobile/app/(tabs)/calendar.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/calendar.tsx#L41-L52).
   * **Detalle:** `writeNow()` serializa todo `LocalAppState` (hasta 1.000 sesiones + todas las tareas y eventos) en un único blob JSON en `AsyncStorage` (`fenced.app.v3`). A medida que el historial crece a varios miles de tareas completadas (que nunca se purgan en `local-store.ts`), `JSON.stringify(state)` en el hilo JS principal empezará a causar *frame drops*. En [`calendar.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/calendar.tsx#L45-L47), `dayEvents`, `allDay` y `due` hacen `new Date(e.startAt)` sobre todos los eventos en cada tick de `useNow(60_000)` si `selected` no está memoizado por día.

---

### 3.4 Experiencia de Usuario y Accesibilidad WCAG (Fase 1.5)

1. **Coexistencia de dos sistemas de UI (Primitivas modernas vs. pantallas legacy sin accesibilidad)**
   * **Evidencia:** Las pantallas rediseñadas (`(tabs)/index.tsx`, `(tabs)/tasks.tsx`, `(tabs)/calendar.tsx`, `session.tsx`, `session-sheet.tsx`, `(onboarding)/age.tsx`) usan [`Txt`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/components/ui/Txt.tsx#L33-L50) y [`AnimatedPressable`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/components/ui/AnimatedPressable.tsx#L25-L56) con soporte ejemplar de VoiceOver/TalkBack, `tabular-nums`, `maxFontSizeMultiplier` y `useReducedMotion()`.
   * En cambio, **11 pantallas secundarias** ([`time-block.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/time-block.tsx#L1-L478), [`planning-chat.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/planning-chat.tsx#L1-L247), [`(tabs)/you.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/you.tsx#L1-L280), [`fence-hub.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/fence-hub.tsx#L1-L200), [`profile/calendar-sync.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/calendar-sync.tsx#L1-L640), [`profile/calendar-export.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/calendar-export.tsx#L1-L546), [`profile/delete.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/delete.tsx#L1-L168), [`profile/export.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/export.tsx#L1-L194), [`profile/age-band.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/age-band.tsx#L1-L278), [`profile/guardian.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/guardian.tsx#L1-L175), [`profile/notifications.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/notifications.tsx#L1-L157)) utilizan `<Text>` y `<Pressable>` crudos de React Native sin `accessibilityRole`, sin `accessibilityLabel` y sin límites de escalado tipográfico.

2. **Incumplimientos puntuales de área táctil mínima WCAG 2.5.5 / Apple HIG (44×44 pt)**
   * [`apps/mobile/app/profile/age-band.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/age-band.tsx#L123-L135) y [`age-band.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/age-band.tsx#L251-L258): Los botones `-` y `+` del selector de mes/año miden `36×36 pt`, no tienen `hitSlop` ni `accessibilityLabel` (un lector de pantalla solo lee *"menos"* sin indicar si es mes o año).
   * [`apps/mobile/app/(tabs)/calendar.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/calendar.tsx#L131-L144) y [`calendar.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/calendar.tsx#L347-L356): `stripItem` tiene `minHeight: 30` sin `hitSlop`.
   * [`apps/mobile/app/(tabs)/_layout.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/_layout.tsx#L10-L20): El botón central flotante `FenceButton` carece de `accessibilityRole="button"` y `accessibilityLabel="Start or configure focus session"`.

3. **Solapamiento del teclado virtual en `PlanningChatScreen`**
   * **Evidencia:** [`apps/mobile/app/planning-chat.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/planning-chat.tsx#L150-L174) y [`planning-chat.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/planning-chat.tsx#L214-L226).
   * **Detalle:** El contenedor `composer` tiene `position: "absolute", bottom: 0` y la pantalla no utiliza `KeyboardAvoidingView`. Al enfocar el `TextInput` en iOS o Android, el teclado cubre completamente la barra de escritura.

4. **Interfaz exclusivamente en inglés pese a tener motor NLP multilingüe**
   * **Evidencia:** [`apps/mobile/src/lib/locale.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/locale.ts#L8-L19).
   * **Detalle:** La app detecta `es` y `ca` para el parser de fechas, pero el 100 % de los textos de la interfaz están codificados en inglés.

---

## 4. Escalabilidad

1. **Estado en memoria incompatible con escalado horizontal (Rate Limiting, Cuota IA y Nonces OAuth)**
   * **Evidencia:**
     * [`apps/api/src/rate-limit.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/rate-limit.ts#L54-L98): `MemoryRateLimitStore` guarda contadores en un `Map` local del proceso Node.js.
     * [`apps/api/src/ai-quota.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/ai-quota.ts#L16-L31): `MemoryRateLimitStore` para la cuota diaria de 30 llamadas IA por usuario (`AI_DAILY_LIMIT_PER_USER`). En cada despliegue o reinicio del contenedor en Render ([`render.yaml`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/render.yaml#L1-L55)), todas las cuotas diarias de Anthropic se resetean a cero, exponiendo el presupuesto de API.
     * [`apps/api/src/integrations/oauth-state.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/oauth-state.ts#L50): `consumedNonces = new Map<string, number>()` solo previene replay dentro de la misma instancia.
   * **Recomendación:** Implementar un adaptador compartido en PostgreSQL (usando una tabla `rate_limits` / `oauth_nonces` con `UNLOGGED` table en Postgres para evitar el coste de un cluster Redis adicional en el MVP) o Upstash Redis.

2. **Jobs cron síncronos sobre HTTP sin cola de trabajos ni paginación (`syncAllCalendars`)**
   * **Evidencia:** [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L98-L123) y [`apps/api/src/integrations/calendar-sync.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/calendar-sync.ts#L618-L632).
   * **Detalle:** `POST /jobs/calendar-sync` llama a `syncAllCalendars(db)` dentro del handler HTTP. `syncAllCalendars` carga **todas** las conexiones habilitadas de la tabla `calendar_connections` sin `LIMIT` y las sincroniza una por una en un bucle `for (const connection of connections) { await syncConnection(...); }`. Con solo 500 usuarios conectados a Google Calendar (a ~400 ms por usuario), el job tardará >200 segundos, superando el timeout HTTP de Render/Cloudflare y abortando a mitad sin cursor de progreso (`last_synced_at ASC LIMIT 50`).
   * **Recomendación:** Ordenar por `lastSyncAt ASC NULLS FIRST LIMIT 50` por invocación o introducir `pg-boss` sobre la misma instancia PostgreSQL.

3. **Pool de conexiones PostgreSQL sin límites explícitos ni cierre ordenado (*Graceful Shutdown*)**
   * **Evidencia:** [`apps/api/src/db/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/index.ts#L10-L12) y [`apps/api/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/index.ts#L1-L26).
   * **Detalle:** `postgres(connectionString, { prepare: false })` se inicializa sin `max` (por defecto 10 conexiones por proceso), `idle_timeout` ni `connect_timeout`. En [`apps/api/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/index.ts#L22) tampoco se capturan señales `SIGTERM`/`SIGINT` para cerrar el servidor HTTP y drenar `client.end()`.

4. **Observabilidad limitada y sin correlación de peticiones (`requestId`)**
   * **Evidencia:** [`apps/api/src/app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L81-L86).
   * **Detalle:** No existe logging estructurado JSON (`pino`), ni cabecera `X-Request-Id`, ni métricas de latencia por procedimiento tRPC, ni alertas de tasa de fallos en el outbox de clientes móviles.

---

## 5. Nuevas funcionalidades

El repositorio contiene un activo diferencial extraordinario: **siete motores algorítmicos ya programados y probados en [`packages/core/src/`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/index.ts#L1-L15) (más `computeReachMap` en [`apps/mobile/src/lib/stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L184-L222))** que aún no han sido expuestos en la interfaz de usuario ni en la API. A continuación se catalogan tanto las funcionalidades listas para conectar como las nuevas capacidades de plataforma:

### 5.1 Funcionalidades ya construidas en `@fenced/core` listas para conectar a UI ("Quick Wins" de alto valor)

1. **Termómetro de Carga Académica y Guardián de Sobrecompromiso (`load-score.ts`)**
   * **Base en código:** [`packages/core/src/load-score.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/load-score.ts#L1-L120).
   * **Qué hace:** Calcula un índice `0–100` (`light`, `balanced`, `heavy`, `overloaded`) cruzando minutos estimados pendientes, cercanía de entregas (3 y 7 días), bloques de calendario ocupados y sesiones completadas, generando sugerencias automáticas de *re-scope* (posponer prioridades bajas o dividir tareas de >60 min).
   * **Dónde conectarlo:** En la cabecera de `Today` ([`apps/mobile/app/(tabs)/index.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/index.tsx#L86-L135)) y dentro del ritual matutino ([`DailyRitual.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/components/today/DailyRitual.tsx#L74-L122)).

2. **Planificación Inversa por Gravedad de Entrega (`schedule/gravity.ts`)**
   * **Base en código:** [`packages/core/src/schedule/gravity.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/gravity.ts#L1-L115).
   * **Qué hace:** Descompone exámenes o proyectos grandes hacia atrás desde la fecha límite en hitos espaciados (`Kickoff & Outline`, `Core Work`, `Review & Polish`) evitando el *cramming* de última hora.
   * **Dónde conectarlo:** Botón *"Break down backward from due date"* en el detalle de tarea ([`apps/mobile/app/task/[id].tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/task/%5Bid%5D.tsx#L174-L233)) para tareas con `estimateMinutes >= 60` y `dueAt != null`.

3. **Auto-programación Consciente de la Energía Biológica (`schedule/energy.ts`)**
   * **Base en código:** [`packages/core/src/schedule/energy.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/energy.ts#L1-L112).
   * **Qué hace:** Construye una curva horaria `0..23` de capacidad real de foco del usuario combinando su historial de sesiones exitosas frente a *shield hits* (intentos de distracción) y su cronotipo (`morning-lark`, `night-owl`, `third-bird`), clasificando franjas `peak`, `dip` y `rebound`.
   * **Dónde conectarlo:** Integrar `scoreGapByEnergy` en [`packages/core/src/schedule/auto-schedule.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/auto-schedule.ts#L1-L260) y [`apps/mobile/src/lib/time-block.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/time-block.ts#L103-L165) para asignar tareas `urgent`/`high` en horas `peak` y tareas mecánicas en horas `dip`.

4. **Mapa de Impulsos 7×24 sin Culpa (`computeReachMap` en `stats.ts`)**
   * **Base en código:** [`apps/mobile/src/lib/stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L184-L222).
   * **Qué hace:** Genera una matriz semanal de 7 días × 24 horas con densidad de foco e intercepciones del escudo, identificando la celda exacta de mayor vulnerabilidad.
   * **Dónde conectarlo:** Añadir tarjeta visual en [`apps/mobile/app/profile/insights.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/insights.tsx#L113-L166) con acción de un toque para crear una *Fenced Hour* en el tramo crítico.

5. **Progresión Espacial Coleccionable "The Yard" (`yard.ts`)**
   * **Base en código:** [`packages/core/src/yard.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/yard.ts#L1-L115).
   * **Qué hace:** Convierte los paneles de valla completados y la racha en materiales desbloqueables (`weathered-oak`, `wrought-iron`, `moss-stone`, `copper-verdigris`) y planos arquitectónicos (`garden-gate`, `courtyard`, `orchard-perimeter`, `watchtower-enclosure`, `sanctuary-grounds`).
   * **Dónde conectarlo:** Pantalla de personalización en `You › Appearance` y vista panorámica coleccionable en `Today` / `Insights`.

6. **Salas Efímeras de Co-Focus sin Chat (`co-focus.ts`)**
   * **Base en código:** [`packages/core/src/co-focus.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/co-focus.ts#L1-L130).
   * **Qué hace:** Modela salas de estudio compartido con código corto de 6 caracteres (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), sin chat libre ni vídeo (100 % seguras bajo COPPA/UK Children's Code), donde cada participante aporta tablas a un panel común.
   * **Dónde conectarlo:** Nuevo router `coFocus` en `apps/api` (con SSE/WebSockets o polling ligero) y selector *"Fence together"* en [`session-sheet.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/session-sheet.tsx#L120-L190).

7. **Motor de Horario Escolar (`class-rules.ts`) y Pacto Familiar Bidireccional (`schemas/pact.ts`)**
   * **Base en código:** [`packages/core/src/class-rules.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/class-rules.ts#L1-L115) y [`packages/core/src/schemas/pact.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schemas/pact.ts#L1-L80).
   * **Qué hace:** `class-rules.ts` activa perfiles de bloqueo automáticos por asignatura/campana escolar respetando festivos y recreos; `pact.ts` define acuerdos simétricos donde tanto el adolescente como el padre/madre se comprometen a minutos semanales de foco y límites de pases de emergencia.

### 5.2 Nuevas funcionalidades de plataforma (No existentes aún en código)

8. **Widgets Interactivos de Pantalla de Inicio, Live Activities y Dynamic Island (iOS 17+ / Android 14+):** Ver el ensamblaje de las tablas de la valla y la cuenta atrás en la isla dinámica o pantalla de bloqueo sin desbloquear el teléfono.
9. **Importación de Calendarios Académicos (Canvas / Moodle / Blackboard / Google Classroom vía URL `.ics`):** La app ya exporta `.ics` ([`packages/ical/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ical/src/index.ts#L1-L180)), pero no permite suscribirse a un feed `.ics` externo de entregas universitarias/escolares para convertirlas automáticamente en tareas con `planDeadlineGravity`.
10. **Desbloqueo Físico por NFC / QR ("Fence Post Tag"):** Opción en modo estricto para requerir acercar el móvil a una etiqueta NFC o código QR pegado fuera del escritorio (ej. en la cocina) para bajar la valla antes de tiempo.

---

## 6. Análisis de mercado y estrategia de diferenciación

### 6.1 Investigación de competidores (2025–2026)

El mercado actual se divide en **tres silos desconectados**:
1. **Gestores de tareas y notas** (*Todoist, TickTick, Things 3, Notion, Linear*): excelentes capturando trabajo, pero incapaces de impedir que el usuario abra TikTok o Instagram a los 3 minutos de empezar una tarea.
2. **Planificadores ejecutivos de calendario e IA** (*Sunsama, Motion, Akiflow, Amie, Reclaim.ai, Superhuman*): diseñados para ejecutivos y trabajadores corporativos con precios prohibitivos ($16–$40/mes), centrados en reuniones de Zoom, Slack y correo, e inaccesibles o ilegales para menores por envío irrestricto de datos a LLMs.
3. **Bloqueadores de apps y temporizadores gamificados** (*Opal, Freedom, one sec, Forest, Flora, Structured, Tiimo, Focusmate*): bloquean el teléfono o muestran un árbol creciendo, pero desconocen por completo qué tareas reales, entregas o huecos de calendario tiene el usuario hoy.

### 6.2 Tabla comparativa del mercado

| Competidor | Categoría principal | Funcionalidades clave | Modelo de precios (2025–2026) | Público objetivo | Puntos fuertes | Quejas frecuentes de usuarios (Reddit, reseñas) |
|---|---|---|---|---|---|---|
| **Notion** | Workspace / Base de datos | Wikis, bases de datos relacionales, notas, IA integrada, Notion Calendar. | Freemium; Plus ~$8–$10/mes (anual); AI add-on extra. | Equipos, estudiantes universitarios, creadores. | Flexibilidad infinita; plantillas para todo. | Lento en móvil; captura rápida de tareas engorrosa; *"procrastinación productiva"* configurando plantillas; cero bloqueo de distracciones. |
| **Todoist** | Gestor de tareas | Entrada rápida NLP multi-idioma, proyectos, filtros, vistas lista/tablero/calendario. | Freemium limitado; Pro ~$4–$5/mes (anual) o ~$5–$8 mensual. | Profesionales y estudiantes multiplataforma. | El mejor parser NLP del mercado; sincronización instantánea en todos los SO. | Fatiga de suscripción tras recortes al plan gratis; no bloquea apps; sensación de "crisis de identidad" por funciones experimentales. |
| **TickTick** | Todo-en-uno (Tareas + Hábitos + Pomo) | Lista de tareas, calendario integrado, Pomodoro, ruido blanco, matriz Eisenhower, hábitos. | Freemium; Premium ~$35.99/año (~$3/mes). | Usuarios intensivos que buscan muchas herramientas por poco dinero. | Relación calidad-precio imbatible; calendario y Pomodoro nativos. | Interfaz saturada (*feature bloat*); el temporizador Pomodoro no bloquea realmente el SO con Screen Time; soporte opaco. |
| **Things 3** | Gestor de tareas minimalista | Jerarquía Áreas/Proyectos, vista *Today*, *This Evening*, atajos de teclado. | Pago único por plataforma (~$10 iPhone, ~$20 iPad, ~$50 Mac; ~$80 total). | Profesionales del ecosistema Apple. | Diseño editorial impecable; sensación de calma; sin suscripción. | Exclusivo de Apple (sin Web/Windows/Android); sin calendario bidireccional nativo; desarrollo estancado ("Things 3 boredom"). |
| **Sunsama** | Planificador diario *mindful* | Ritual guiado de planificación matutina y cierre vespertino, timeboxing, integraciones. | ~$16–$17/mes (anual) o ~$20/mes (mensual). Sin plan gratis. | Trabajadores del conocimiento con riesgo de *burnout*. | Previene la sobrecarga diaria; rituales humanos muy cuidados. | Demasiado caro (~$200/año) para requerir arrastrar todo manualmente; móvil secundario; sin bloqueo de apps. |
| **Motion** | Auto-scheduler con IA | Replanificación automática continua de tareas y reuniones mediante IA, proyectos. | ~$19/mes (anual) o ~$29/mes (mensual). | Ejecutivos y agencias con agendas cambiantes. | Replanifica solo cuando una reunión se alarga. | Genera ansiedad ver el calendario cambiar constantemente; requiere micro-configurar cada tarea; pivote corporativo caro. |
| **Akiflow** | Agregador / Command Center | Bandeja universal (Slack, Gmail, Notion, Linear, Todoist), barra de comandos, time-blocking. | ~$19/mes (anual) o ~$34/mes (mensual). | *Power users* de escritorio con múltiples herramientas B2B. | Velocidad extrema con teclado; consolida 10 apps en una. | App móvil floja y con bugs reportados en Reddit; precio mensual muy alto ($34); quejas por priorizar IA ("Aki") sobre funciones base. |
| **Amie** | Calendario + Tareas + Email | Diseño lúdico, programación rápida en calendario, cliente de email ligero. | Freemium; Pro ~$10–$15/mes. | Creativos, founders y usuarios centrados en calendario. | Estética cuidada y fluidez visual. | Gestión de tareas y metadatos demasiado superficial para proyectos complejos; sin bloqueo de distracciones. |
| **Superhuman** | Email + Suite IA | Procesamiento ultrarrápido de correo por teclado, *Split Inbox*, agentes IA. | ~$30/mes (Starter) a ~$40/mes (Business). | Ejecutivos, ventas, inversores con alto volumen de email. | Latencia <100 ms; experiencia táctil/teclado referente del sector. | Precio prohibitivo ($360–$480/año); funciones IA avanzadas bloqueadas en el plan más caro; enfocado en correo, no en foco profundo. |
| **Linear** | Gestión de producto e issues | Ciclos, *triage*, sincronización con GitHub, navegación instantánea local-first. | Gratis (hasta 250 issues); Basic $10/usuario/mes; Business $16/mes. | Equipos de ingeniería y producto. | Estándar de oro en rendimiento local-first y diseño sobrio. | Inadecuado para vida personal o estudio académico; muro de 250 issues en el plan gratuito. |
| **Opal** | Bloqueador de apps (iOS/Android) | Bloqueo duro con `FamilyControls`, modos de sesión profunda, informes de tiempo en pantalla. | Freemium muy restringido; Pro ~$99/año. | Usuarios con adicción al móvil y redes sociales. | Integración sólida con el escudo nativo de iOS; estética moderna. | Críticas constantes en Reddit por su precio (~$100/año), *upsells* agresivos en pruebas gratuitas y desconexión total de tareas/calendario. |
| **one sec / Forest / Freedom** | Fricción / Gamificación / VPN Blocker | *one sec*: pausa respiratoria al abrir apps; *Forest*: plantar árboles; *Freedom*: bloqueo multi-dispositivo por VPN. | *Forest*: ~$4 pago único; *one sec*: ~$15–$40; *Freedom*: ~$40/año. | Estudiantes (*Forest*) y minimalistas digitales. | *one sec* rompe el hábito automático; *Forest* es barato y amigable. | *Forest* se engaña fácilmente y castiga matando el árbol; *Freedom* en iOS usa VPN local que drena batería; *one sec* depende de automatizaciones frágiles de Atajos. |
| **Structured / Tiimo / Focusmate** | Planificadores TDAH y Body-Doubling | *Structured/Tiimo*: línea temporal visual; *Focusmate*: sesiones en vídeo 1-a-1. | *Structured*: ~$30/año ($100 lifetime); *Tiimo*: ~$45/año; *Focusmate*: ~$8–$12/mes. | Estudiantes y personas neurodivergentes (TDAH). | Muy accesibles cognitivamente; *Focusmate* aporta responsabilidad social. | Subidas drásticas de precio en *Structured*; compañeros impuntuales o incomodidad de cámara en *Focusmate* (inviable para menores). |

---

### 6.3 Huecos del mercado identificados

1. **El hueco "Planificar → Proteger" (*Plan-to-Shield Gap*):** Ningún competidor cierra el ciclo completo en móvil. Si planificas tu tarde en *Todoist*, *TickTick* o *Sunsama*, tu teléfono sigue permitiendo abrir Instagram a mitad del bloque. Si usas *Opal* o *Freedom*, bloqueas el teléfono pero no tienes tus tareas, subtareas, fechas de entrega ni bloques de tiempo delante. **Fenced es la única app donde aceptar un bloque de tiempo en el calendario levanta físicamente un escudo del sistema operativo sobre las apps distractoras.**
2. **El vacío de productividad ética y legal para jóvenes (12–22 años) y familias:** Herramientas como *Motion*, *Notion AI* o *Focusmate* no cumplen COPPA ni el *UK Age Appropriate Design Code* (envían PII a LLMs, usan telemetría invasiva o vídeo con desconocidos). Al mismo tiempo, los controles parentales tradicionales (*Apple Screen Time*, *Family Link*, *Bark*) son herramientas de vigilancia vertical ("padres espiando a hijos"), lo que genera rechazo en adolescentes. No existe una herramienta de **autonomía y pacto mutuo** para estudiantes.
3. **IA sin pérdida de control ni ansiedad (*AI suggests · deterministic packer decides*):** Los usuarios de *Motion* en Reddit se quejan de que la IA mueve sus bloques sin permiso generando ansiedad. El enfoque arquitectónico de Fenced ([`packages/ai/src/soft-prefs.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ai/src/soft-prefs.ts#L1-L82) + [`packages/core/src/schedule/auto-schedule.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/auto-schedule.ts#L1-L260)) —donde el LLM solo propone preferencias blandas y un algoritmo determinista auditable coloca los bloques bajo confirmación humana— resuelve exactamente esa fricción.
4. **Refuerzo constructivo frente al castigo punitivo:** *Forest* mata tu árbol si atiendes una urgencia; los contadores de racha tradicionales caen a `0` si enfermas un día. La metáfora de Fenced (**un panel de valla que queda a medio construir pero nunca se borra, y un Pase de Emergencia que deja una junta reparada en lugar de romper la racha** en [`stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L89-L115)) es psicológicamente superior para usuarios con TDAH y ansiedad académica.

---

### 6.4 Propuesta de 7 ideas diferenciadoras concretas y originales

#### Idea 1: Auto-Blocker vinculado al Calendario y Nivel de Energía ("Energy-Aware Shielded Time-Blocking")
* **Problema que resuelve:** Los bloques de tiempo en el calendario suelen ser "papel mojado": cuando llega la hora de estudiar o hacer *deep work*, el usuario está cansado o abre redes sociales por inercia.
* **A quién va dirigida:** Estudiantes universitarios, opositores y profesionales con TDAH o alta fragmentación de atención.
* **Cómo aprovecha el código actual:** Conecta [`packages/core/src/schedule/energy.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/energy.ts#L1-L112) (`computeEnergyCurve` + `scoreGapByEnergy`) con [`packages/core/src/schedule/auto-schedule.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/auto-schedule.ts#L1-L260) y [`apps/mobile/src/lib/time-block.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/time-block.ts#L103-L165), haciendo que todo evento con `source === "time-block"` arme automáticamente `FencedBlocking` al comenzar su franja.
* **Esfuerzo estimado:** **M** (Conectar `energy.ts` a `time-block.ts` es **S**; armar el escudo programado con `DeviceActivityCenter` nativo es **M**).
* **Impacto:** **Muy Alto** — Une en un solo gesto lo que hoy exige pagar *Sunsama/Motion* + *Opal*.
* **Riesgo:** **Medio** — Requiere que la extensión nativa de `DeviceActivityMonitor` en iOS sea fiable en segundo plano.

#### Idea 2: Descomposición Inversa por Gravedad de Examen + Termómetro de Sobrecarga ("Deadline Gravity & Overcommitment Guard")
* **Problema que resuelve:** Los estudiantes apuntan *"Entregar TFG / Examen de Cálculo el 20 de mayo"* pero no saben cuándo empezar ni cuánto abarca su semana hasta que es demasiado tarde.
* **A quién va dirigida:** Estudiantes de secundaria, bachillerato y universidad.
* **Cómo aprovecha el código actual:** El motor matemático ya está 100 % escrito y probado en [`packages/core/src/schedule/gravity.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schedule/gravity.ts#L1-L115) (`planDeadlineGravity`) y [`packages/core/src/load-score.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/load-score.ts#L1-L120) (`calculateLoadScore`). Solo falta exponer el indicador `0–100` en `Today` ([`index.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/(tabs)/index.tsx#L95-L115)) y el botón de generación de hitos en [`task/[id].tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/task/%5Bid%5D.tsx#L174-L233) y [`DailyRitual.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/components/today/DailyRitual.tsx#L74-L122).
* **Esfuerzo estimado:** **S** (Lógica de dominio ya completada; solo requiere UI en 3 componentes).
* **Impacto:** **Alto** — Transforma una lista pasiva de tareas en un tutor académico preventivo 100 % local y gratuito en coste de IA.
* **Riesgo:** **Bajo** — Cero dependencias externas ni llamadas de red.

#### Idea 3: Salas Efímeras de Co-Focus sin Chat ("Silent Timber Rooms" — Body-Doubling seguro para menores y adultos)
* **Problema que resuelve:** Estudiar solo cuesta; pero *Focusmate* o Discord exponen a menores y estudiantes a cámaras, desconocidos o chats donde se acaba procrastinando.
* **A quién va dirigida:** Grupos de estudio en institutos/universidades y amigos que quieren concentrarse juntos en silencio.
* **Cómo aprovecha el código actual:** [`packages/core/src/co-focus.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/co-focus.ts#L1-L130) ya implementa la generación de códigos de 6 caracteres sin vocales ambiguas, límite de participantes, cálculo de tablas colectivas (`targetPickets`) y prohibición de texto libre para cumplir COPPA y UK Children's Code.
* **Esfuerzo estimado:** **M** (Añadir tabla efímera/router tRPC `coFocus` en `apps/api` y vista compartida en `session.tsx`).
* **Impacto:** **Muy Alto** — Introduce viralidad orgánica (*network effects* entre compañeros de clase) sin comprometer la privacidad infantil.
* **Riesgo:** **Bajo/Medio** — Requiere sincronización ligera de estado de sala cada 10–15 s.

#### Idea 4: Pacto Familiar Simétrico ("Mutual Focus Pact": Padres e Hijos bajo la misma regla)
* **Problema que resuelve:** Los adolescentes odian las apps de control parental porque los padres les bloquean el móvil mientras ellos miran el suyo durante la cena.
* **A quién va dirigida:** Familias con hijos de 11 a 17 años (`child` y `teen`).
* **Cómo aprovecha el código actual:** [`packages/core/src/schemas/pact.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/schemas/pact.ts#L1-L80) (`PactSchema`, `validatePactCompliance`) ya modela compromisos simétricos (`parentCommitment` y `teenCommitment` con `weeklyTargetMinutes` y `maxEmergencyPasses`) mostrando cumplimiento mutuo sin revelar nunca qué apps concretas intentó abrir el menor ni el título de sus tareas privadas.
* **Esfuerzo estimado:** **M** (Endpoint de emparejamiento familiar en `apps/api` + tarjeta de Pacto en `You` / `Today`).
* **Impacto:** **Alto** — Desbloquea el canal de pago B2C más rentable para apps de estudiantes: **los padres pagan la suscripción familiar** porque fomenta convivencia en vez de vigilancia.
* **Riesgo:** **Bajo** — Diseño de privacidad ya alineado con [`docs/06-youth-compliance.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/06-youth-compliance.md#L1-L120).

#### Idea 5: Radar 7×24 de Impulsos y Auto-Defensa de Horas Vulnerables ("Breach Reach Map → 1-Tap Guard")
* **Problema que resuelve:** Los usuarios no saben a qué hora exacta del día pierden el control frente al scroll infinito; los informes de *Screen Time* solo dicen "usaste 4 horas hoy" cuando el día ya terminó.
* **A quién va dirigida:** Cualquier usuario que busque reducir su tiempo en pantalla sin sentirse juzgado.
* **Cómo aprovecha el código actual:** [`apps/mobile/src/lib/stats.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/stats.ts#L184-L222) ya incluye `computeReachMap(history)` (matriz 7×24 con `maxDensityCell` y `totalReclaimedMinutes`), y [`apps/mobile/app/profile/insights.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/insights.tsx#L77-L86) ya tiene `fenceWeakHour()`.
* **Esfuerzo estimado:** **S** (Conectar `computeReachMap` a un mapa de calor 7×24 en `insights.tsx`).
* **Impacto:** **Medio/Alto** — Convierte la analítica pasiva en una acción preventiva automática.
* **Riesgo:** **Bajo**.

#### Idea 6: Construcción Arquitectónica "The Yard" y Modo Horario Escolar ("School Bell & Yard Mastery")
* **Problema que resuelve:** Las rachas numéricas simples aburren tras 2 semanas; y durante el horario de clases el estudiante olvida activar el bloqueo manualmente.
* **A quién va dirigida:** Estudiantes de secundaria/universidad y amantes del diseño táctil (*Things 3* / *Forest* fans).
* **Cómo aprovecha el código actual:** [`packages/core/src/yard.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/yard.ts#L1-L115) (`computeYardProgression`) y [`packages/core/src/class-rules.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/class-rules.ts#L1-L115) (`evaluateClassSchedule`) ya están listos en `@fenced/core`, junto con los materiales visuales de [`packages/ui/src/tokens/theme.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ui/src/tokens/theme.ts#L118-L167) (`FenceAssemblyView`).
* **Esfuerzo estimado:** **S/M**.
* **Impacto:** **Alto** en retención a D30 y D90 sin caer en ludopatía ni *streaks* tóxicos.
* **Riesgo:** **Bajo**.

#### Idea 7: "Physical Fence Post" — Desbloqueo por Etiqueta NFC / Código QR físico e Importación `.ics` de Canvas/Moodle
* **Problema que resuelve:** Incluso con un retraso de 15 minutos en modo estricto (`GateBreather`), cuando el usuario está en la cama o en el escritorio con ansiedad puede esperar y cancelar la sesión; además, meter a mano todas las entregas del semestre da pereza.
* **A quién va dirigida:** Usuarios de *deep work* extremo y universitarios que usan Canvas/Blackboard/Moodle.
* **Cómo aprovecha el código actual:** Reutiliza la máquina de sesiones estrictas en [`apps/mobile/src/lib/session-engine.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/session-engine.ts#L138-L153) añadiendo un modo `unlockMethod: "delay" | "qr-post"` y extiende [`packages/ical/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ical/src/index.ts#L1-L180) con un parser ligero de `VEVENT` entrantes para importar entregas académicas.
* **Esfuerzo estimado:** **M**.
* **Impacto:** **Alto** — Diferenciador viral en TikTok/Reels estudiantiles y eliminación de fricción de *onboarding* cada inicio de semestre.
* **Riesgo:** **Bajo**.

---

### 6.5 Posicionamiento de producto recomendado y selección para el MVP diferencial

> **Posición de producto recomendada (1 frase):**
> *"Fenced es el planificador calmado que protege tu calendario en el mundo real: convierte tus tareas y entregas en bloques de foco con bloqueo nativo del teléfono, diseñado sin culpa y seguro por diseño desde los 12 años hasta la universidad y el trabajo profundo."*

**Las 3 ideas priorizadas para el MVP diferencial (máximo retorno con el código ya existente):**
1. **Prioridad 1 — Cierre del bucle "Planificar → Bloquear" (Idea 1 + resolución de P0 nativo):** Hacer realidad el puente nativo Swift/Kotlin en `native/fenced-blocking` y conectar `schedule/energy.ts` a `time-block.ts` para que los bloques planificados levanten automáticamente el escudo del SO.
2. **Prioridad 2 — Tutor Académico Local (Idea 2: `load-score.ts` + `gravity.ts` + Idea 5: `computeReachMap`):** Esfuerzo **S** (ya programado en `@fenced/core` y `stats.ts`) que diferencia inmediatamente a Fenced de *Opal*, *Forest* y *Todoist* desde el primer día de uso offline.
3. **Prioridad 3 — Salas Efímeras "Silent Timber Rooms" y Pacto Familiar (Ideas 3 y 4: `co-focus.ts` + `pact.ts`):** Crecimiento viral orgánico entre compañeros de estudio y monetización ética vía suscripción familiar.

---

## 7. Roadmap priorizado

### 7.1 Matriz de Priorización (Impacto vs. Esfuerzo)

| Iniciativa / Mejora | Tipo | Esfuerzo | Impacto | Prioridad |
|---|---|---|---|---|
| Corregir SEC-01 (`retention-enforcement.ts`), SEC-02 (`updateAgeBand`), SEC-03 (IDOR FKs) y SEC-04 (limpieza en `signOut`) | Seguridad / Legal | **S** | **Crítico** | **Inmediata (Bloqueante)** |
| Implementar targets nativos Swift (`FamilyControls` + `DeviceActivity`) y Kotlin en `native/fenced-blocking` | Core P0 | **L** | **Crítico** | **Inmediata (Bloqueante)** |
| Conectar motores existentes en `@fenced/core` (`load-score`, `gravity`, `energy`, `computeReachMap`, `yard`) a la UI móvil | Producto / Diferenciación | **S** | **Muy Alto** | **Alta (Quick Win)** |
| Corregir bug de `planning-chat.tsx` (`applyProposeTool`), `age-band.tsx` y migrar tokens de Supabase a `expo-secure-store` (SEC-05) | Calidad / Seguridad | **S** | **Alto** | **Alta** |
| Verificar JWT localmente con JWKS (`auth.ts`), añadir índices compuestos y reglas `onDelete` en Drizzle (`schema.ts`) | Rendimiento / BD | **S** | **Alto** | **Alta** |
| Migrar `MemoryRateLimitStore`, `ai-quota` y `consumedNonces` a store compartido en Postgres/Redis + paginar `syncAllCalendars` | Escalabilidad | **M** | **Alto** | **Media** |
| Implementar notificaciones locales reales (`expo-notifications`) para *Fenced Hours* y recordatorios | Producto | **M** | **Alto** | **Media** |
| Lanzar Salas Efímeras de Co-Focus (`co-focus.ts`) y Pacto Familiar Simétrico (`pact.ts`) | Crecimiento / Monetización | **M** | **Muy Alto** | **Media** |
| Unificar las 11 pantallas legacy bajo `Txt`/`AnimatedPressable`, corregir accesibilidad WCAG e internacionalizar UI (`es`/`ca`/`en`) | UX / WCAG | **M** | **Medio** | **Media** |
| Importador `.ics` académico (Canvas/Moodle), Widgets / Live Activities y desbloqueo por QR/NFC | Expansión | **L** | **Alto** | **Horizonte 3** |

---

### 7.2 Plan de ejecución en tres horizontes

#### Horizonte 1: Arreglos urgentes y desbloqueo de lanzamiento (Semanas 1–4)
1. **Seguridad y Cumplimiento COPPA/GDPR-K (Semana 1):**
   * Eliminar el borrado de `consent_events` en [`retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts#L10-L19) (SEC-01) para preservar el historial *append-only* y purgar en su lugar las entidades de cuentas revocadas vencidas.
   * Corregir [`user.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/user.ts#L217-L236) (`updateAgeBand`) exigiendo un `scope` específico de verificación parental/edad y sincronizar [`age-band.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/age-band.tsx#L34-L45) con `api.user.updateAgeBand` (SEC-02, SEC-10).
   * Validar propiedad (`userId === ctx.userId`), auto-referencia y profundidad de subtareas en `task.create/update`, `session.create` y `calendar.create/update` (SEC-03).
   * Invocar `resetAppState()`, `resetOnboarding()` y `clearOutbox()` dentro de `signOut()` en [`auth.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/auth.tsx#L147-L150) (SEC-04) y mover la sesión de Supabase a `expo-secure-store` (SEC-05).
   * Restringir CORS a orígenes permitidos, añadir límites `.max()` en Zod para [`fence.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/fence.ts#L18-L19) y [`calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/calendar.ts#L64-L69), envolver `/webhooks/vpc` y `calendar.delete` en `db.transaction()`, y eliminar la regex destructiva `/<[^>]*>/g` (SEC-06 a SEC-09).
2. **Estabilidad de Datos, Rendimiento Base y Bugs UI (Semana 2):**
   * Añadir políticas `onDelete: "set null"` / `"cascade"` e índices compuestos en [`schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L67-L250) + columna `occurrence_index` en `tasks`.
   * Reemplazar `supabase.auth.getUser(token)` en [`auth.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/auth.ts#L55) por verificación local JWKS (`jose`) y eliminar el subselect `pg_timezone_names` en [`streak-rollover.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/streak-rollover.ts#L21).
   * Pasar `suggestedHorizon` y `softPreferences` desde [`planning-chat.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/planning-chat.tsx#L74-L83) a [`time-block.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/time-block.tsx#L38-L39) y añadir `KeyboardAvoidingView` en `planning-chat.tsx`.
3. **Puente Nativo de Bloqueo iOS y Android (Semanas 2–4):**
   * Implementar el módulo Expo nativo en `native/fenced-blocking` con las 3 extensiones de iOS (`FamilyControls`, `ManagedSettings`, `DeviceActivityMonitor` + `ShieldConfigurationExtension` + App Group `group.com.fenced.app`) y el `ForegroundService` + `UsageStatsManager` en Android.

#### Horizonte 2: Diferenciación del MVP y escalabilidad (Meses 1–3)
1. **Conexión de los motores diferenciales de `@fenced/core` a la experiencia móvil:**
   * Integrar `calculateLoadScore` en `Today` y `DailyRitual`; `planDeadlineGravity` en `task/[id].tsx`; `computeEnergyCurve` en `time-block.ts`; `computeReachMap` en `insights.tsx`; y `computeYardProgression` en `Today` / `Appearance`.
2. **Activación real de *Fenced Hours* y Notificaciones:**
   * Registrar ventanas de `fencedHours` en `DeviceActivityCenter` (iOS) / `AlarmManager` (Android) e integrar `expo-notifications` para que [`notifications.tsx`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/app/profile/notifications.tsx#L1-L157) programe avisos locales reales no coercitivos.
3. **Escalabilidad del Backend y Observabilidad:**
   * Persistir `rate-limit`, `ai-quota` y `oauth-state` nonces en PostgreSQL/Redis; paginar `syncAllCalendars` con lotes y `AbortSignal.timeout(10_000)` en [`google-calendar.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/google-calendar.ts#L147-L225); integrar `@sentry/react-native` y PostHog (con filtro estricto para menores) y suite de tests de integración para los routers tRPC.
4. **Unificación de UI y Accesibilidad WCAG 2.2 AA:**
   * Migrar las 11 pantallas secundarias a las primitivas `Txt` y `AnimatedPressable`, corregir áreas táctiles <44 pt y traducir la interfaz a español y catalán (aprovechando que `@fenced/nlp` ya soporta `en`, `es` y `ca`).

#### Horizonte 3: Expansión de ecosistema, efectos de red y monetización (Meses 3–12)
1. **Salas Efímeras "Silent Timber Rooms" (`co-focus.ts`) y Horario Escolar (`class-rules.ts`):**
   * Despliegue de salas de foco sincronizado por código de 6 caracteres sin chat y activación automática por horario de clases.
2. **Plan Familiar con Pacto Simétrico (`schemas/pact.ts`) e Integración VPC:**
   * Lanzamiento del flujo de consentimiento parental verificado con proveedor VPC real (KWS / PRIVO) y panel de Pacto Mutuo Padre-Adolescente.
3. **Ecosistema Académico y Hardware Físico/OS:**
   * Suscripción a feeds `.ics` externos (Canvas, Moodle, Google Classroom, Outlook) con descomposición automática de exámenes; Widgets interactivos de iOS/Android, Live Activities en Dynamic Island y desbloqueo físico opcional mediante etiqueta NFC / QR ("Fence Post").

---

## 8. Anexo: fuentes consultadas

### 8.1 Fuentes internas del repositorio auditadas
* **Documentación y auditorías previas:** [`docs/10-full-audit-and-improvements.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/10-full-audit-and-improvements.md#L1-L86), [`docs/design_audit.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/design_audit.md#L1-L265), [`docs/01-user-flows.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/01-user-flows.md#L1-L140), [`docs/02-information-architecture.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/02-information-architecture.md#L1-L98), [`docs/03-brand-direction.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/03-brand-direction.md#L1-L221), [`docs/04-tech-stack.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/04-tech-stack.md#L1-L296), [`docs/05-platform-constraints.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/05-platform-constraints.md#L1-L162), [`docs/06-youth-compliance.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/06-youth-compliance.md#L1-L214), [`docs/07-roadmap.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/07-roadmap.md#L1-L176), [`docs/08-theming-and-calendar-sync.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/08-theming-and-calendar-sync.md#L1-L237), [`docs/09-local-first-sync-and-sessions.md`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/docs/09-local-first-sync-and-sessions.md#L1-L185).
* **Backend (`apps/api`):** [`app.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/app.ts#L1-L246), [`auth.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/auth.ts#L1-L65), [`consent.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/consent.ts#L1-L36), [`rate-limit.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/rate-limit.ts#L1-L108), [`ai-quota.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/ai-quota.ts#L1-L32), [`db/schema.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/db/schema.ts#L1-L327), [`jobs/retention-enforcement.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/retention-enforcement.ts#L1-L24), [`jobs/streak-rollover.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/jobs/streak-rollover.ts#L1-L39), routers tRPC en [`apps/api/src/trpc/routers/`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/trpc/routers/index.ts#L1-L26) e integraciones en [`apps/api/src/integrations/`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/api/src/integrations/calendar-sync.ts#L1-L632).
* **Mobile (`apps/mobile`) y Paquetes (`packages/*`, `native/*`):** [`local-store.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/local-store.ts#L1-L854), [`session-engine.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/session-engine.ts#L1-L187), [`sync/engine.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/apps/mobile/src/lib/sync/engine.ts#L1-L135), [`packages/core/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/core/src/index.ts#L1-L15), [`packages/policy/src/feature-access.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/policy/src/feature-access.ts#L1-L115), [`packages/ai/src/generate.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/packages/ai/src/generate.ts#L1-L185), [`native/fenced-blocking/src/index.ts`](file:///C:/Users/wenqi/Ubuntu/Projects/Fenced/native/fenced-blocking/src/index.ts#L1-L306).

### 8.2 Fuentes externas de mercado, precios y análisis de competidores
1. **Todoist, TickTick, Things 3 y Notion (Precios y comparativas 2025–2026):**
   * Todoist Pricing & Plans: `https://www.todoist.com/pricing`
   * TickTick Premium Pricing & Features: `https://ticktick.com/upgrade`
   * Cultured Code — Things 3 Ecosystem Pricing (Mac, iPad, iPhone): `https://culturedcode.com/things/`
   * Notion Pricing Plans (Free, Plus, Business, AI): `https://www.notion.com/pricing`
   * TechWise Insider / ToolFinder — *Todoist vs TickTick vs Things 3 Long-Term Review & Reddit Consensus (r/productivity, r/todoist, r/thingsapp)*: `https://toolfinder.co/`
2. **Sunsama, Motion, Akiflow, Amie y Reclaim.ai (Planificadores ejecutivos y time-blocking):**
   * Sunsama Pricing & Daily Planning Ritual Manifesto: `https://www.sunsama.com/pricing`
   * Motion AI Scheduler Pricing & Capabilities: `https://www.usemotion.com/pricing`
   * Akiflow Command Center Pricing & Integrations: `https://akiflow.com/pricing`
   * Amie Joyful Productivity & Calendar: `https://amie.so/`
   * Reclaim.ai Smart Calendar & Habit Defense Plans: `https://reclaim.ai/pricing`
   * Morgen / ToolFinder — *Best Time Blocking & AI Scheduling Apps Compared (Sunsama vs Motion vs Akiflow vs Reclaim)*: `https://www.morgen.so/blog/best-time-blocking-apps`
3. **Superhuman y Linear (Herramientas de alta velocidad orientadas a atajos y diseño local-first):**
   * Linear Pricing & Issue Tracking Architecture: `https://linear.app/pricing`
   * Superhuman Mail & AI Workspace Pricing (Starter / Business): `https://superhuman.com/pricing`
4. **Opal, Freedom, one sec, Forest, Structured, Tiimo y Focusmate (Bloqueadores de apps, TDAH y estudio social):**
   * Opal Screen Time App Blocker Pricing & FAQ: `https://www.opal.so/pricing`
   * Freedom Cross-Device Distraction Blocker: `https://freedom.to/pricing`
   * one sec App Intervention & Mindful Friction: `https://one-sec.app/`
   * Forest App — Stay Focused, Be Present: `https://www.forestapp.cc/`
   * Structured Daily Planner Pricing & Roadmap: `https://structured.app/`
   * Tiimo Visual Neurodivergent Planner: `https://www.tiimoapp.com/`
   * Focusmate Virtual Co-Working & Body-Doubling: `https://www.focusmate.com/pricing`
   * Comunidades de usuarios analizadas para puntos de dolor recurrentes: `https://www.reddit.com/r/productivity/`, `https://www.reddit.com/r/nosurf/`, `https://www.reddit.com/r/digitalminimalism/` y `https://www.reddit.com/r/structuredapp/`.
5. **Normativa de Privacidad de Menores y Accesibilidad:**
   * FTC COPPA Rule (16 CFR Part 312): `https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa`
   * UK ICO Age Appropriate Design Code (Children's Code): `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/`
   * W3C WCAG 2.2 Target Size & Accessible Authentication Guidelines: `https://www.w3.org/TR/WCAG22/`
