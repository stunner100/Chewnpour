import React from 'react';

const MaintenanceScreen = () => (
    <main className="min-h-screen bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-xl rounded-[2rem] border border-border-light dark:border-border-dark bg-white/90 dark:bg-card-dark/90 shadow-xl p-8 sm:p-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary mb-4">
                Scheduled maintenance
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                ChewnPour is under scheduled maintenance
            </h1>
            <p className="text-base sm:text-lg text-text-muted-light dark:text-text-muted-dark leading-7 mb-6">
                We are moving the database to a more scalable setup so the app
                can stay fast as traffic grows.
            </p>
            <p className="text-sm font-semibold text-text-faint-light dark:text-text-faint-dark">
                Please try again shortly.
            </p>
        </section>
    </main>
);

export default MaintenanceScreen;
