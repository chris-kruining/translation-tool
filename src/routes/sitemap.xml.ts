import { SitemapStream, streamToPromise } from 'sitemap'
import { App } from 'vinxi';

const BASE_URL = 'https://ca-euw-prd-calque-app.purplecoast-f5b7f657.westeurope.azurecontainerapps.io';

export async function GET() {

    const sitemap = new SitemapStream({ hostname: BASE_URL });

    sitemap.write({ url: BASE_URL, changefreq: 'monthly', });

    for (const route of await getRoutes()) {
        sitemap.write({ url: route, changefreq: 'monthly', });
    }

    sitemap.end();

    return new Response(
        (await streamToPromise(sitemap)).toString(),
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
}

const getRoutes = async () => {
    const router = ((globalThis as any).app as App).getRouter('client').internals.routes;

    if (router === undefined) {
        return [];
    }

    const routes = await router.getRoutes() as { page: boolean, $$route?: object, path: string }[];

    return routes
        .filter(r => r.page === true && r.$$route === undefined && !r.path.match(/^.+\*\d+$/))
        .map(r => r.path.replace(/\/\(\w+\)/g, ''));
};