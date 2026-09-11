import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/shell/AppShell';

// Patient Components
import { PatientHome } from './components/patient/PatientHome';
import { ViewJourney } from './components/patient/ViewJourney';
import { PatientHistory } from './components/patient/PatientHistory';
import { PatientSettings } from './components/patient/PatientSettings';

// Clinician Components
import { ClinicianOverview } from './components/clinician/ClinicianOverview';
import { ClinicianPatients } from './components/clinician/ClinicianPatients';
import { ClinicianSessions } from './components/clinician/ClinicianSessions';
import { ClinicianRecordings } from './components/clinician/ClinicianRecordings';
import { ClinicianAnnotations } from './components/clinician/ClinicianAnnotations';
import { ClinicianSettings } from './components/clinician/ClinicianSettings';

// Researcher Components
import { ResearchOverview } from './components/researcher/ResearchOverview';
import { ResearchDatasets } from './components/researcher/ResearchDatasets';
import { ResearchRecordings } from './components/researcher/ResearchRecordings';
import { ResearchParticipants } from './components/researcher/ResearchParticipants';
import { ResearchSessions } from './components/researcher/ResearchSessions';
import { ResearchAnnotations } from './components/researcher/ResearchAnnotations';
import { ResearchEvaluation } from './components/researcher/ResearchEvaluation';
import { ResearchModels } from './components/researcher/ResearchModels';

// Settings Components
import { UserSettings } from './components/settings/UserSettings';

const AppContent: React.FC = () => {
  const { currentUser, role, activeTab } = useApp();

  // If no user is authenticated, render the role-based auth screen
  if (!currentUser) {
    return <AuthScreen />;
  }

  // Render role-specific and tab-specific view
  const renderActiveView = () => {
    if (role === 'patient') {
      switch (activeTab) {
        case 'home':
        case 'therapy':
          return <PatientHome />;
        case 'journey':
          return <ViewJourney />;
        case 'progress':
          return <PatientHistory />;
        case 'settings':
          return <PatientSettings />;
        default:
          return <PatientHome />;
      }
    }

    if (role === 'clinician') {
      switch (activeTab) {
        case 'overview':
          return <ClinicianOverview />;
        case 'patients':
          return <ClinicianPatients />;
        case 'sessions':
          return <ClinicianSessions />;
        case 'recordings':
          return <ClinicianRecordings />;
        case 'annotations':
          return <ClinicianAnnotations />;
        case 'settings':
          return <ClinicianSettings />;
        default:
          return <ClinicianOverview />;
      }
    }

    if (role === 'researcher') {
      switch (activeTab) {
        case 'overview':
          return <ResearchOverview />;
        case 'datasets':
          return <ResearchDatasets />;
        case 'recordings':
          return <ResearchRecordings />;
        case 'participants':
          return <ResearchParticipants />;
        case 'sessions':
          return <ResearchSessions />;
        case 'annotations':
          return <ResearchAnnotations />;
        case 'evaluation':
          return <ResearchEvaluation />;
        case 'models':
          return <ResearchModels />;
        case 'settings':
          return <UserSettings />;
        default:
          return <ResearchOverview />;
      }
    }

    return <PatientHome />;
  };

  return (
    <AppShell>
      {renderActiveView()}
    </AppShell>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
