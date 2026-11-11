import { useState } from "react";

import { activityApi, projectApi } from "../api/endpoints";
import { ActivityFeed } from "../components/ActivityFeed";
import { Alert, Card, PageHeader, PageLoader, Select } from "../components/ui";
import { useOrg } from "../context/OrgContext";
import { useLoader } from "../lib/useLoader";

export function ActivityPage() {
  const { current } = useOrg();
  const [projectId, setProjectId] = useState("");
  const projects = useLoader(() => projectApi.list({ organization: current!.id }), [current?.id]);
  const activity = useLoader(
    () => activityApi.list({ organization: current!.id, project: projectId ? Number(projectId) : undefined, limit: 200 }),
    [current?.id, projectId],
  );

  if (!current) return null;

  function renderActivity() {
    if (activity.loading) return <PageLoader />;
    if (activity.error) {
      return (
        <div className="py-3">
          <Alert>{activity.error}</Alert>
        </div>
      );
    }
    return <ActivityFeed items={activity.data ?? []} showProject={!projectId} />;
  }

  return (
    <>
      <PageHeader
        title="Activity"
        description="A history of everything that happened in this organization."
        actions={
          <Select aria-label="Filter by project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="sm:w-56">
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "archived" ? " (archived)" : ""}
              </option>
            ))}
          </Select>
        }
      />
      <Card className="px-5 py-2">
        {renderActivity()}
      </Card>
    </>
  );
}
