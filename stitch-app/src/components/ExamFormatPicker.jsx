import React from 'react';
import ExamLoadingShell from './ExamLoadingShell';
import AppIcon from './AppIcon';

const ExamFormatPicker = ({ onChooseFormat }) => (
    <ExamLoadingShell variant="custom" padded>
        <div className="w-full max-w-md">
            <div className="card-base p-8 text-center">
                <div className="size-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <AppIcon name="quiz" className="text-3xl text-primary" />
                </div>
                <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">Choose Quiz Format</h2>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-8">How would you like to be tested?</p>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => onChooseFormat('mcq')}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-all text-left group"
                    >
                        <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                            <AppIcon name="radio_button_checked" className="text-primary" />
                        </div>
                        <div>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Objective Quiz</p>
                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Multiple choice, true/false, and fill in the blank</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onChooseFormat('essay')}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark hover:border-[#B75E45] hover:bg-[#B75E45]/5 transition-all text-left group"
                    >
                        <div className="size-11 rounded-xl bg-[#B75E45]/10 flex items-center justify-center group-hover:bg-[#B75E45]/15 transition-colors">
                            <AppIcon name="edit_note" className="text-[#B75E45]" />
                        </div>
                        <div>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Essay / Theory</p>
                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Write your answers in your own words</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </ExamLoadingShell>
);

export default ExamFormatPicker;
