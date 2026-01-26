import About from './pages/About';
import AccountProfile from './pages/AccountProfile';
import Admin from './pages/Admin';
import AgentLanding from './pages/AgentLanding';
import AgentMatching from './pages/AgentMatching';
import AgentOnboarding from './pages/AgentOnboarding';
import Agents from './pages/Agents';
import Contact from './pages/Contact';
import ContractVerify from './pages/ContractVerify';
import FAQ from './pages/FAQ';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import IdentityVerification from './pages/IdentityVerification';
import Inbox from './pages/Inbox';
import InvestorLanding from './pages/InvestorLanding';
import InvestorOnboarding from './pages/InvestorOnboarding';
import InvestorProfile from './pages/InvestorProfile';
import Investors from './pages/Investors';
import Logout from './pages/Logout';
import MyAgreement from './pages/MyAgreement';
import NDA from './pages/NDA';
import NewDeal from './pages/NewDeal';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import Pipeline from './pages/Pipeline';
import PostAuth from './pages/PostAuth';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import RoleLanding from './pages/RoleLanding';
import Room from './pages/Room';
import Terms from './pages/Terms';
import __Layout from './Layout.jsx';


export const PAGES = {
    "About": About,
    "AccountProfile": AccountProfile,
    "Admin": Admin,
    "AgentLanding": AgentLanding,
    "AgentMatching": AgentMatching,
    "AgentOnboarding": AgentOnboarding,
    "Agents": Agents,
    "Contact": Contact,
    "ContractVerify": ContractVerify,
    "FAQ": FAQ,
    "Home": Home,
    "HowItWorks": HowItWorks,
    "IdentityVerification": IdentityVerification,
    "Inbox": Inbox,
    "InvestorLanding": InvestorLanding,
    "InvestorOnboarding": InvestorOnboarding,
    "InvestorProfile": InvestorProfile,
    "Investors": Investors,
    "Logout": Logout,
    "MyAgreement": MyAgreement,
    "NDA": NDA,
    "NewDeal": NewDeal,
    "NotFound": NotFound,
    "Onboarding": Onboarding,
    "Pipeline": Pipeline,
    "PostAuth": PostAuth,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "RoleLanding": RoleLanding,
    "Room": Room,
    "Terms": Terms,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};