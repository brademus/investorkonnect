import AccountProfile from './pages/AccountProfile';
import Admin from './pages/Admin';
import AgentLanding from './pages/AgentLanding';
import AgentOnboarding from './pages/AgentOnboarding';
import DocuSignReturn from './pages/DocuSignReturn';
import Home from './pages/Home';
import IdentityVerification from './pages/IdentityVerification';
import InvestorLanding from './pages/InvestorLanding';
import InvestorOnboarding from './pages/InvestorOnboarding';
import Logout from './pages/Logout';
import MyAgreement from './pages/MyAgreement';
import NDA from './pages/NDA';
import NewDeal from './pages/NewDeal';
import NotFound from './pages/NotFound';
import Pipeline from './pages/Pipeline';
import PostAuth from './pages/PostAuth';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import RoleLanding from './pages/RoleLanding';
import Room from './pages/Room';
import Terms from './pages/Terms';
import PipelineStage from './pages/PipelineStage';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountProfile": AccountProfile,
    "Admin": Admin,
    "AgentLanding": AgentLanding,
    "AgentOnboarding": AgentOnboarding,
    "DocuSignReturn": DocuSignReturn,
    "Home": Home,
    "IdentityVerification": IdentityVerification,
    "InvestorLanding": InvestorLanding,
    "InvestorOnboarding": InvestorOnboarding,
    "Logout": Logout,
    "MyAgreement": MyAgreement,
    "NDA": NDA,
    "NewDeal": NewDeal,
    "NotFound": NotFound,
    "Pipeline": Pipeline,
    "PostAuth": PostAuth,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "RoleLanding": RoleLanding,
    "Room": Room,
    "Terms": Terms,
    "PipelineStage": PipelineStage,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};