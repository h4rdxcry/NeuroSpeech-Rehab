import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import PatientLayout from './components/patient/PatientLayout'
import PatientHome from './components/patient/PatientHome'
import PatientSession from './components/patient/PatientSession'
import PatientProgress from './components/patient/PatientProgress'
import PatientSettings from './components/patient/PatientSettings'
import ClinicianLayout from './components/clinician/ClinicianLayout'
import ClinicianDashboard from './components/clinician/ClinicianDashboard'
import ClinicianPatients from './components/clinician/ClinicianPatients'
import ClinicianSessions from './components/clinician/ClinicianSessions'
import ResearchLayout from './components/research/ResearchLayout'
import ResearchDashboard from './components/research/ResearchDashboard'
import ResearchDatasets from './components/research/ResearchDatasets'
import ResearchParticipants from './components/research/ResearchParticipants'
import ResearchModels from './components/research/ResearchModels'
import ResearchRecordings from './components/research/ResearchRecordings'
import ResearchAnnotations from './components/research/ResearchAnnotations'
import ResearchEvaluation from './components/research/ResearchEvaluation'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/patient/session" replace />} />
      <Route path="/login" element={<Navigate to="/patient/session" replace />} />
      <Route path="/patient" element={<PatientLayout />}>
        <Route index element={<Navigate to="/patient/session" replace />} />
        <Route path="session" element={<PatientSession />} />
        <Route path="home" element={<PatientHome />} />
        <Route path="progress" element={<PatientProgress />} />
        <Route path="settings" element={<PatientSettings />} />
      </Route>
      <Route path="/clinician" element={<ClinicianLayout />}>
        <Route index element={<ClinicianDashboard />} />
        <Route path="patients" element={<ClinicianPatients />} />
        <Route path="recordings" element={<ResearchRecordings />} />
        <Route path="annotations" element={<ResearchAnnotations />} />
        <Route path="sessions" element={<ClinicianSessions />} />
      </Route>
      <Route path="/research" element={<ResearchLayout />}>
        <Route index element={<ResearchDashboard />} />
        <Route path="datasets" element={<ResearchDatasets />} />
        <Route path="participants" element={<ResearchParticipants />} />
        <Route path="sessions" element={<ClinicianSessions />} />
        <Route path="models" element={<ResearchModels />} />
        <Route path="recordings" element={<ResearchRecordings />} />
        <Route path="annotations" element={<ResearchAnnotations />} />
        <Route path="evaluation" element={<ResearchEvaluation />} />
      </Route>
      <Route path="*" element={<Navigate to="/patient/session" replace />} />
    </Routes>
  )
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}
