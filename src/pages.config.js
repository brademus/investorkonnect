import AccountProfile from './pages/AccountProfile';
import Admin from './pages/Admin';
import AgentLanding from './pages/AgentLanding';
import AgentOnboarding from './pages/AgentOnboarding';
import DocuSignReturn from './pages/DocuSignReturn';
import Home from './pages/Home';
import IdentityVerification from './pages/IdentityVerification';
import InvestorLanding from './pages/InvestorLanding';
import Logout from './pages/Logout';
import MyAgreement from './pages/MyAgreement';
import NDA from './pages/NDA';
import NewDeal from './pages/NewDeal';
import NotFound from './pages/NotFound';
import Pipeline from './pages/Pipeline';
import PipelineStage from './pages/PipelineStage';
import PostAuth from './pages/PostAuth';
import Privacy from './pages/Privacy';
import RoleLanding from './pages/RoleLanding';
import Room from './pages/Room';
import Terms from './pages/Terms';
import Pricing from './pages/Pricing';
import InvestorOnboarding from './pages/InvestorOnboarding';
import BillingSuccess from './pages/BillingSuccess';
import ContractVerify from './pages/ContractVerify';
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
    "Logout": Logout,
    "MyAgreement": MyAgreement,
    "NDA": NDA,
    "NewDeal": NewDeal,
    "NotFound": NotFound,
    "Pipeline": Pipeline,
    "PipelineStage": PipelineStage,
    "PostAuth": PostAuth,
    "Privacy": Privacy,
    "RoleLanding": RoleLanding,
    "Room": Room,
    "Terms": Terms,
    "Pricing": Pricing,
    "InvestorOnboarding": InvestorOnboarding,
    "BillingSuccess": BillingSuccess,
    "ContractVerify": ContractVerify,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};