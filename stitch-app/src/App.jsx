import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';
import OnboardingName from './pages/OnboardingName';
import OnboardingLevel from './pages/OnboardingLevel';
import OnboardingDepartment from './pages/OnboardingDepartment';
import Subscription from './pages/Subscription';
import DashboardAnalysis from './pages/DashboardAnalysis';
import DashboardProcessing from './pages/DashboardProcessing';
import DashboardCourse from './pages/DashboardCourse';
import TopicDetail from './pages/TopicDetail';
import ExamMode from './pages/ExamMode';
import DashboardResults from './pages/DashboardResults';
import DashboardFullAnalysis from './pages/DashboardFullAnalysis';
import Profile from './pages/Profile';
import PastQuestionsComingSoon from './pages/PastQuestionsComingSoon';
import ConceptIntro from './pages/ConceptIntro';
import ConceptBuilder from './pages/ConceptBuilder';
import AssignmentHelper from './pages/AssignmentHelper';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding Routes */}
        <Route path="/onboarding/name" element={<OnboardingName />} />
        <Route path="/onboarding/level" element={<ProtectedRoute><OnboardingLevel /></ProtectedRoute>} />
        <Route path="/onboarding/department" element={<ProtectedRoute><OnboardingDepartment /></ProtectedRoute>} />

        {/* Protected Dashboard Routes — wrapped in DashboardLayout for mobile nav */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardAnalysis /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/processing" element={<ProtectedRoute><DashboardLayout><DashboardProcessing /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/processing/:courseId" element={<ProtectedRoute><DashboardLayout><DashboardProcessing /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/course/:courseId" element={<ProtectedRoute><DashboardLayout><DashboardCourse /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/topic/:topicId" element={<ProtectedRoute><DashboardLayout><TopicDetail /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/exam" element={<ProtectedRoute><DashboardLayout><PastQuestionsComingSoon /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/exam/:topicId" element={<ProtectedRoute><DashboardLayout><ExamMode /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/results" element={<ProtectedRoute><DashboardLayout><DashboardResults /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/results/:attemptId" element={<ProtectedRoute><DashboardLayout><DashboardResults /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/analysis" element={<ProtectedRoute><DashboardLayout><DashboardFullAnalysis /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/assignment-helper" element={<ProtectedRoute><DashboardLayout><AssignmentHelper /></DashboardLayout></ProtectedRoute>} />

        {/* Concept Flow */}
        <Route path="/dashboard/concept-intro" element={<ProtectedRoute><DashboardLayout><ConceptIntro /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/concept-intro/:topicId" element={<ProtectedRoute><DashboardLayout><ConceptIntro /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/concept" element={<ProtectedRoute><DashboardLayout><ConceptBuilder /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/concept/:topicId" element={<ProtectedRoute><DashboardLayout><ConceptBuilder /></DashboardLayout></ProtectedRoute>} />

        {/* Subscription Route */}
        <Route path="/subscription" element={<ProtectedRoute><DashboardLayout><Subscription /></DashboardLayout></ProtectedRoute>} />

        {/* Profile Route */}
        <Route path="/profile" element={<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;

