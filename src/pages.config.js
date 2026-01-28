import AccountProfile from './pages/AccountProfile';
import Admin from './pages/Admin';
import AgentLanding from './pages/AgentLanding';
import AgentOnboarding from './pages/AgentOnboarding';
import BillingSuccess from './pages/BillingSuccess';
import ContractVerify from './pages/ContractVerify';
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
import PipelineStage from './pages/PipelineStage';
import PostAuth from './pages/PostAuth';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import RoleLanding from './pages/RoleLanding';
import Room from './pages/Room';
import SelectAgent from './pages/SelectAgent';
import Terms from './pages/Terms';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountProfile": AccountProfile,
    "Admin": Admin,
    "AgentLanding": AgentLanding,
    "AgentOnboarding": AgentOnboarding,
    "BillingSuccess": BillingSuccess,
    "ContractVerify": ContractVerify,
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
    "PipelineStage": PipelineStage,
    "PostAuth": PostAuth,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "RoleLanding": RoleLanding,
    "Room": Room,
    "SelectAgent": SelectAgent,
    "Terms": Terms,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};