import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { fetchJobs, updateJobStatus, protectedCall, type JobData } from '../../services/api';

const statuses = [
  'saved',
  'applied',
  'processing',
  'interview',
  'offer',
  'rejected',
  'no_response',
  'interview_scheduled',
  'technical_interview',
  'offer_letter_received',
  'follow_up_sent',
  'withdrawn',
];

const columnColors: Record<string, string> = {
  saved: 'bg-gray-50',
  applied: 'bg-blue-50',
  processing: 'bg-yellow-50',
  interview: 'bg-purple-50',
  offer: 'bg-green-50',
  rejected: 'bg-red-50',
  no_response: 'bg-gray-50',
  interview_scheduled: 'bg-indigo-50',
  technical_interview: 'bg-cyan-50',
  offer_letter_received: 'bg-emerald-50',
  follow_up_sent: 'bg-orange-50',
  withdrawn: 'bg-rose-50',
};

interface Props {
  onDataChange: () => void;
}

const KanbanBoard = ({ onDataChange }: Props) => {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    try {
      const res = await fetchJobs();
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const jobId = draggableId;
    const newStatus = destination.droppableId;

    // Optimistic update
    setJobs((prev) =>
      prev.map((job) => (job._id === jobId ? { ...job, status: newStatus } : job))
    );

    try {
      await protectedCall(() => updateJobStatus(jobId, newStatus));
      onDataChange();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
      loadJobs();
    }
  };

  if (loading) return <div className="text-center py-8">Loading board...</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <Droppable droppableId={status} key={status}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`${columnColors[status]} rounded-xl w-64 flex-shrink-0 p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {status.replace(/_/g, ' ')}
                  </h3>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 shadow-sm">
                    {jobs.filter((job) => job.status === status).length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {jobs
                    .filter((job) => job.status === status)
                    .map((job, index) => (
                      <Draggable key={job._id} draggableId={job._id!} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-white rounded-lg shadow-sm p-3 cursor-grab active:cursor-grabbing"
                          >
                            <p className="font-medium text-gray-900">{job.role}</p>
                            <p className="text-xs text-gray-500">{job.company}</p>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;