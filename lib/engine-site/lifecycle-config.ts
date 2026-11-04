/** Small server configuration boundary, safe to import before loading generation/media/provider modules. */
export const ENGINE_BOOK_SCOPE = 'engine_site_book';
export const engineFulfillmentEnabled = (env: Readonly<Record<string, string | undefined>> = process.env) => env.ENGINE_SITE_FULFILLMENT_ENABLED === 'true';
