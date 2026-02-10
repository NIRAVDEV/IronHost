'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();

        // Handle the OAuth callback
        const handleCallback = async () => {
            const { error } = await supabase.auth.exchangeCodeForSession(
                window.location.href.split('?')[1]?.split('code=')[1]?.split('&')[0] || ''
            );

            if (error) {
                console.error('Auth callback error:', error);
                router.push('/login?error=callback_failed');
                return;
            }

            router.push('/dashboard');
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Completing sign in...</p>
            </div>
        </div>
    );
}
