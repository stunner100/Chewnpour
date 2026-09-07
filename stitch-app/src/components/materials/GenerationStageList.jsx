import React from 'react';
import AppIcon from '../AppIcon';
import { GENERATION_STAGES } from '../../lib/generationStages';

const GenerationStageList = ({ stageIndex = 0 }) => (
    <ol className="mt-4 space-y-1.5" aria-label="Course generation progress">
        {GENERATION_STAGES.map((stage, index) => {
            const done = index < stageIndex;
            const current = index === stageIndex;
            return (
                <li key={stage.id} className="flex items-center gap-2 text-caption">
                    <span
                        aria-hidden="true"
                        className={`flex size-4 items-center justify-center rounded-full ${
                            done
                                ? 'bg-success text-white'
                                : current
                                    ? 'border-2 border-primary'
                                    : 'border border-border-default'
                        }`}
                    >
                        {done ? <AppIcon name="check" className="text-[10px]" /> : null}
                    </span>
                    <span className={current ? 'font-semibold text-text-primary' : 'text-text-muted'}>
                        {stage.label}
                    </span>
                </li>
            );
        })}
    </ol>
);

export default GenerationStageList;
