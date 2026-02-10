import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export default async function proxy(request: NextRequest) {
    try {
        console.log('ProxyMiddleware: Executing for', request.nextUrl.pathname);
        console.log('ProxyMiddleware: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Defined' : 'Missing');
        console.log('ProxyMiddleware: Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Defined' : 'Missing');

        let supabaseResponse = NextResponse.next({
            request,
        });

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) =>
                            request.cookies.set(name, value)
                        );
                        supabaseResponse = NextResponse.next({
                            request,
                        });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        // Refresh the session (important for keeping tokens valid)
        const {
            data: { user },
        } = await supabase.auth.getUser();

        // Protect dashboard routes - redirect to login if not authenticated
        if (
            !user &&
            request.nextUrl.pathname.startsWith('/dashboard')
        ) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        // Redirect authenticated users away from auth pages
        if (
            user &&
            (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')
        ) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }

        return supabaseResponse;
    } catch (error: any) {
        console.error('ProxyMiddleware Error:', error);
        return new NextResponse(
            JSON.stringify({
                error: 'ProxyMiddleware failed',
                message: error.message,
                stack: error.stack,
            }),
            { status: 500, headers: { 'content-type': 'application/json' } }
        );
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
