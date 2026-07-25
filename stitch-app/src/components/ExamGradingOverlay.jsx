import AppIcon from './AppIcon';
const ExamGradingOverlay = () => (
    <div className="fixed inset-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="card-base p-8 text-center max-w-sm w-full">
            <div className="size-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                <AppIcon name="psychology" className="text-3xl text-primary" />
            </div>
            <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Grading Your Answers</h3>
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Our AI is reading and evaluating each of your responses. This may take a moment…</p>
            <div className="mt-6 w-full h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '70%' }} />
            </div>
        </div>
    </div>
);

export default ExamGradingOverlay;
