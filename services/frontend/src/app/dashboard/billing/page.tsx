import Link from 'next/link';

// Pricing plan card
function PlanCard({
    name,
    price,
    features,
    isCurrent = false,
    isPopular = false,
}: {
    name: string;
    price: number;
    features: string[];
    isCurrent?: boolean;
    isPopular?: boolean;
}) {
    return (
        <div className={`glass-card rounded-xl p-6 relative ${isPopular ? 'border-primary-500/50' : ''}`}>
            {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium rounded-full gradient-primary text-white">
                    Most Popular
                </div>
            )}
            <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">{name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-foreground">${price}</span>
                    <span className="text-muted-foreground">/mo</span>
                </div>
            </div>
            <ul className="space-y-3 mb-6">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 flex-shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                    </li>
                ))}
            </ul>
            <button
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${isCurrent
                        ? 'bg-muted text-muted-foreground cursor-default'
                        : 'gradient-primary text-white hover:opacity-90'
                    }`}
                disabled={isCurrent}
            >
                {isCurrent ? 'Current Plan' : 'Upgrade'}
            </button>
        </div>
    );
}

// Invoice row
function InvoiceRow({
    id,
    date,
    amount,
    status,
}: {
    id: string;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
}) {
    const statusStyles = {
        paid: 'bg-green-500/10 text-green-400 border-green-500/30',
        pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        failed: 'bg-red-500/10 text-red-400 border-red-500/30',
    };

    return (
        <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" x2="8" y1="13" y2="13" />
                        <line x1="16" x2="8" y1="17" y2="17" />
                    </svg>
                </div>
                <div>
                    <p className="font-medium text-foreground">Invoice #{id}</p>
                    <p className="text-sm text-muted-foreground">{date}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <span className="font-medium text-foreground">${amount.toFixed(2)}</span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyles[status]} capitalize`}>
                    {status}
                </span>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default function BillingPage() {
    const plans = [
        {
            name: 'Starter',
            price: 5,
            features: ['1 Server', '2 GB RAM', '10 GB Storage', 'Basic Support'],
        },
        {
            name: 'Pro',
            price: 15,
            features: ['5 Servers', '8 GB RAM each', '50 GB Storage', 'Priority Support', 'Custom Domain'],
            isCurrent: true,
            isPopular: true,
        },
        {
            name: 'Enterprise',
            price: 49,
            features: ['Unlimited Servers', '32 GB RAM each', '500 GB Storage', '24/7 Support', 'Dedicated IP', 'DDoS Protection'],
        },
    ];

    const invoices = [
        { id: 'INV-2024-001', date: 'Feb 1, 2024', amount: 15.00, status: 'paid' as const },
        { id: 'INV-2024-002', date: 'Jan 1, 2024', amount: 15.00, status: 'paid' as const },
        { id: 'INV-2023-012', date: 'Dec 1, 2023', amount: 15.00, status: 'paid' as const },
        { id: 'INV-2023-011', date: 'Nov 1, 2023', amount: 15.00, status: 'paid' as const },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Billing</h1>
                <p className="text-muted-foreground">Manage your subscription and payment methods</p>
            </div>

            {/* Current plan summary */}
            <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                        <p className="text-2xl font-bold gradient-text">Pro Plan</p>
                        <p className="text-sm text-muted-foreground mt-1">$15.00/month • Renews Feb 28, 2024</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors">
                            Cancel Plan
                        </button>
                        <button className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition-opacity">
                            Upgrade
                        </button>
                    </div>
                </div>
            </div>

            {/* Pricing plans */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => (
                        <PlanCard key={plan.name} {...plan} />
                    ))}
                </div>
            </div>

            {/* Payment method */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Payment Method</h2>
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold text-sm">
                                VISA
                            </div>
                            <div>
                                <p className="font-medium text-foreground">•••• •••• •••• 4242</p>
                                <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium rounded bg-primary-500/10 text-primary-400 border border-primary-500/30">
                                Default
                            </span>
                            <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <button className="mt-4 flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                        </svg>
                        Add Payment Method
                    </button>
                </div>
            </div>

            {/* Invoices */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
                    <button className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                        View All
                    </button>
                </div>
                <div className="glass-card rounded-xl px-6">
                    {invoices.map((invoice) => (
                        <InvoiceRow key={invoice.id} {...invoice} />
                    ))}
                </div>
            </div>
        </div>
    );
}
