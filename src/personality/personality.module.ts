import { Module } from '@nestjs/common';
import { PersonalityService } from './personality.service.js';
import { DelayCalculatorService } from './delay-calculator.service.js';
import { SkipEvaluatorService } from './skip-evaluator.service.js';
import { ProactiveService } from './proactive.service.js';

@Module({
  providers: [
    PersonalityService,
    DelayCalculatorService,
    SkipEvaluatorService,
    ProactiveService,
  ],
  exports: [PersonalityService, ProactiveService],
})
export class PersonalityModule {}
