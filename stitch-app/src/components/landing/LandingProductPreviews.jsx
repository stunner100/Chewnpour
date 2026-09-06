import HeroProductDemo from './HeroProductDemo';
import {
  BrowserFrame,
  LessonHome,
  ProductShell,
  ScaledStage,
} from './landingProductChrome';

export const LandingDashboardPreview = () => <HeroProductDemo />;

export const LandingLessonPreview = () => (
  <BrowserFrame label="ChewnPour lesson with Start quiz and AI Tutor">
    <ScaledStage>
      <ProductShell activeNav="Lessons">
        <LessonHome />
      </ProductShell>
    </ScaledStage>
  </BrowserFrame>
);
