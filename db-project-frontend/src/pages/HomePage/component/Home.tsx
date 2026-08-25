import HeroSection from "./HeroSection";
import PlatformImpactSection from "./PlatformImpactSection";
import WhyCrimeLensSection from "./WhyCrimeLensSection";
import CoreFeaturesSection from "./CoreFeaturesSection";
import MapShowcaseSection from "./MapShowcaseSection";
import StatsShowcaseSection from "./StatsShowcaseSection";
import InsightsSection from "./InsightsSection";
import UserPersonasSection from "./UserPersonasSection";
import WorkflowSection from "./WorkflowSection";
import FinalCTASection from "./FinalCTASection";
import FooterSection from "./FooterSection";
import "./shared/styles.css";

const Home = () => {
  return (
    <div className="bg-white">
      <HeroSection />
      <PlatformImpactSection />
      <WhyCrimeLensSection />
      <CoreFeaturesSection />
      <MapShowcaseSection />
      <StatsShowcaseSection />
      <InsightsSection />
      <UserPersonasSection />
      <WorkflowSection />
      <FinalCTASection />
      <FooterSection />
    </div>
  );
};

export default Home;
