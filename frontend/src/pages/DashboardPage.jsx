import { useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useActiveSessions, useCreateSession, useMyRecentSessions } from "../hooks/useSessions";
import { sessionApi } from "../api/sessions";

import Navbar from "../components/Navbar";
import WelcomeSection from "../components/WelcomeSection";
import StatsCards from "../components/StatsCards";
import ActiveSessions from "../components/ActiveSessions";
import RecentSessions from "../components/RecentSessions";
import CreateSessionModal from "../components/CreateSessionModal";

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomConfig, setRoomConfig] = useState({ problem: "", difficulty: "" });

  const createSessionMutation = useCreateSession();

  const extractSessionId = (payload) => payload?.session?._id || payload?.session?.id || payload?.sessionId;

  const { data: activeSessionsData, isLoading: loadingActiveSessions } = useActiveSessions();
  const { data: recentSessionsData, isLoading: loadingRecentSessions } = useMyRecentSessions();

  const handleCreateRoom = async () => {
    if (!roomConfig.problem || !roomConfig.difficulty) return;

    try {
      const payload = {
        problem: roomConfig.problem,
        difficulty: roomConfig.difficulty.toLowerCase(),
      };

      const data = await createSessionMutation.mutateAsync(payload);
      let sessionId = extractSessionId(data);

      if (!sessionId) {
        const fallback = await sessionApi.getActiveSessions();
        const matchingSession = fallback?.sessions?.find(
          (session) =>
            session.problem === payload.problem &&
            session.difficulty === payload.difficulty &&
            session.host?.clerkId === user?.id
        );

        sessionId = matchingSession?._id || matchingSession?.id;
      }

      if (!sessionId) {
        console.error("createSession success but session id missing", data);
        toast.error("Session created, but opening it failed. Please open it from Active Sessions.");
        setShowCreateModal(false);
        return;
      }

      setShowCreateModal(false);
      navigate(`/session/${sessionId}`);
    } catch {
      // handled by the mutation's onError toast
    }
  };

  const activeSessions = activeSessionsData?.sessions || [];
  const recentSessions = recentSessionsData?.sessions || [];

  const isUserInSession = (session) => {
    if (!user.id) return false;

    return session.host?.clerkId === user.id || session.participant?.clerkId === user.id;
  };

  return (
    <>
      <div className="min-h-screen bg-base-300">
        <Navbar />
        <WelcomeSection onCreateSession={() => setShowCreateModal(true)} />

        {/* Grid layout */}
        <div className="container mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatsCards
              activeSessionsCount={activeSessions.length}
              recentSessionsCount={recentSessions.length}
            />
            <ActiveSessions
              sessions={activeSessions}
              isLoading={loadingActiveSessions}
              isUserInSession={isUserInSession}
            />  
          </div>

          <RecentSessions sessions={recentSessions} isLoading={loadingRecentSessions} />
        </div>
      </div>

      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        roomConfig={roomConfig}
        setRoomConfig={setRoomConfig}
        onCreateRoom={handleCreateRoom}
        isCreating={createSessionMutation.isPending}
      />
    </>
  );
}

export default DashboardPage;
