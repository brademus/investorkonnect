/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccountProfile from './pages/AccountProfile';
import Admin from './pages/Admin';
import AgentLanding from './pages/AgentLanding';
import AgentOnboarding from './pages/AgentOnboarding';
import AgentProfile from './pages/AgentProfile';
import BillingSuccess from './pages/BillingSuccess';
import ContractVerify from './pages/ContractVerify';
import CounterOffer from './pages/CounterOffer';
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
import SelectAgent from './pages/SelectAgent';
import SendCounter from './pages/SendCounter';
import Terms from './pages/Terms';
import Room from './pages/Room';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccountProfile": AccountProfile,
    "Admin": Admin,
    "AgentLanding": AgentLanding,
    "AgentOnboarding": AgentOnboarding,
    "AgentProfile": AgentProfile,
    "BillingSuccess": BillingSuccess,
    "ContractVerify": ContractVerify,
    "CounterOffer": CounterOffer,
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
    "SelectAgent": SelectAgent,
    "SendCounter": SendCounter,
    "Terms": Terms,
    "Room": Room,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};