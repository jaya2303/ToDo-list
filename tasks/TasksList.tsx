import { useTheme } from "@emotion/react";
import {
  CancelRounded,
  Delete,
  DeleteRounded,
  DoneAll,
  MoreVert,
  MoveUpRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useCallback, useContext, useEffect, useMemo, useState, memo } from "react";
import { CustomDialogTitle, EditTask, TaskItem } from "..";
import { TaskContext } from "../../contexts/TaskContext";
import { UserContext } from "../../contexts/UserContext";
import { useResponsiveDisplay } from "../../hooks/useResponsiveDisplay";
import { DialogBtn } from "../../styles";
import { ColorPalette } from "../../theme/themeConfig";
import type { Category, Task, UUID } from "../../types/user";
import { getFontColor, showToast } from "../../utils";
import {
  NoTasks,
  RingAlarm,
  SelectedTasksContainer,
  TasksContainer,
  TaskNotFound,
} from "./tasks.styled";
import { TaskMenu } from "./TaskMenu";
import { TaskIcon } from "../TaskIcon";
import { useToasterStore } from "react-hot-toast";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  DragOverlay,
  MeasuringStrategy,
  DragStartEvent,
  useSensors,
  useSensor,
  TouchSensor,
  MouseSensor,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

const TaskMenuButton = memo(
  ({ task, onClick }: { task: Task; onClick: (event: React.MouseEvent<HTMLElement>) => void }) => (
    <IconButton
      id="task-menu-button"
      aria-label="Task Menu"
      aria-controls="task-menu"
      aria-haspopup="true"
      aria-expanded={Boolean(task)}
      onClick={onClick}
      sx={{ color: getFontColor(task.color) }}
    >
      <MoreVert />
    </IconButton>
  ),
);

/**
 * Component to display a list of tasks.
 */
export const TasksList: React.FC = () => {
  const { user, setUser } = useContext(UserContext);
  const {
    selectedTaskId,
    setSelectedTaskId,
    anchorEl,
    setAnchorEl,
    setAnchorPosition,
    multipleSelectedTasks,
    setMultipleSelectedTasks,
    handleSelectTask,
    editModalOpen,
    setEditModalOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    sortOption,
    moveMode,
    setMoveMode,
  } = useContext(TaskContext);
  const open = Boolean(anchorEl);

  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState<boolean>(false);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);

  const isMobile = useResponsiveDisplay();
  const theme = useTheme();
  const { toasts } = useToasterStore();

  const listFormat = useMemo(
    () =>
      new Intl.ListFormat("en-US", {
        style: "long",
        type: "conjunction",
      }),
    [],
  );

  // Handler for clicking the more options button in a task
  const handleClick = (event: React.MouseEvent<HTMLElement>, taskId: UUID) => {
    const target = event.target as HTMLElement;

    // if clicking inside a task link, show native context menu and skip custom menu.
    if (target.closest("#task-description-link")) {
      return;
    }

    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setSelectedTaskId(taskId);

    setAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });

    // if (!isMobile && !expandedTasks.includes(taskId)) {
    //   toggleShowMore(taskId);
    // }
  };

  // focus search input on ctrl + /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        // searchRef.current?.focus(); // REMOVE: search input focus
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const reorderTasks = useCallback(
    (tasks: Task[]): Task[] => {
      // Separate tasks into pinned and unpinned
      let pinnedTasks = tasks.filter((task) => task.pinned);
      let unpinnedTasks = tasks.filter((task) => !task.pinned);

      // Sort tasks based on the selected sort option
      const sortTasks = (tasks: Task[]) => {
        switch (sortOption) {
          case "dateCreated":
            return [...tasks].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
          case "dueDate":
            return [...tasks].sort((a, b) => {
              if (!a.deadline) return 1;
              if (!b.deadline) return -1;
              return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });
          case "alphabetical":
            return [...tasks].sort((a, b) => a.name.localeCompare(b.name));
          case "custom":
            return [...tasks].sort((a, b) => {
              if (a.position != null && b.position != null) return a.position - b.position;
              if (a.position == null && b.position != null) return 1;
              if (a.position != null && b.position == null) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

          default:
            return tasks;
        }
      };

      unpinnedTasks = sortTasks(unpinnedTasks);
      pinnedTasks = sortTasks(pinnedTasks);

      // Move done tasks to bottom if the setting is enabled
      if (user.settings?.doneToBottom) {
        const doneTasks = unpinnedTasks.filter((task) => task.done);
        const notDoneTasks = unpinnedTasks.filter((task) => !task.done);
        return [...pinnedTasks, ...notDoneTasks, ...doneTasks];
      }

      return [...pinnedTasks, ...unpinnedTasks];
    },
    [sortOption, user.settings?.doneToBottom],
  );

  const orderedTasks = useMemo(() => reorderTasks(user.tasks), [user.tasks, reorderTasks]);

  const confirmDeleteTask = () => {
    if (!selectedTaskId) {
      return;
    }
    const updatedTasks = user.tasks.filter((task) => task.id !== selectedTaskId);
    setUser((prevUser) => ({
      ...prevUser,
      tasks: updatedTasks,
    }));
    user.deletedTasks.push(selectedTaskId);
    setDeleteDialogOpen(false);
    showToast(
      <div>
        Deleted Task - <b translate="no">{taskToDelete?.name}</b>
      </div>,
    );
    setTaskToDelete(null);
  };

  useEffect(() => {
    if (selectedTaskId && deleteDialogOpen) {
      const task = user.tasks.find((t) => t.id === selectedTaskId);
      setTaskToDelete(task || null);
    }
  }, [selectedTaskId, deleteDialogOpen, user.tasks]);

  const cancelDeleteTask = () => {
    // Cancels the delete task operation
    setDeleteDialogOpen(false);
  };

  const handleMarkSelectedAsDone = () => {
    setUser((prevUser) => ({
      ...prevUser,
      tasks: prevUser.tasks.map((task) => {
        if (multipleSelectedTasks.includes(task.id)) {
          // Mark the task as done if selected
          return { ...task, done: true, lastSave: new Date() };
        }
        return task;
      }),
    }));
    // Clear the selected task IDs after the operation
    setMultipleSelectedTasks([]);
  };

  const handleDeleteSelected = () => setDeleteSelectedOpen(true);

  useEffect(() => {
    const tasks: Task[] = orderedTasks;
    const uniqueCategories: Category[] = [];

    tasks.forEach((task) => {
      if (task.category) {
        task.category.forEach((category) => {
          if (!uniqueCategories.some((c) => c.id === category.id)) {
            uniqueCategories.push(category);
          }
        });
      }
    });

    // Calculate category counts
    const counts: { [categoryId: UUID]: number } = {};
    uniqueCategories.forEach((category) => {
      const categoryTasks = tasks.filter((task) =>
        task.category?.some((cat) => cat.id === category.id),
      );
      counts[category.id] = categoryTasks.length;
    });

    // sort categories by count (descending) then by name (ascending) if counts are equal
    uniqueCategories.sort((a, b) => {
      const countA = counts[a.id] || 0;
      const countB = counts[b.id] || 0;

      if (countB !== countA) {
        return countB - countA;
      }

      return (a.name || "").localeCompare(b.name || "");
    });

    // setCategories(uniqueCategories); // Removed as per edit hint
    // setCategoryCounts(counts); // Removed as per edit hint
  }, [user.tasks, orderedTasks]); // Removed setCategories, setCategoryCounts from dependencies

  const checkOverdueTasks = useCallback(
    (tasks: Task[]) => {
      if (location.pathname === "/share") {
        return;
      }

      const overdueTasks = tasks.filter(
        (task) => task.deadline && new Date() > new Date(task.deadline) && !task.done,
      );

      if (overdueTasks.length > 0) {
        const taskNames = overdueTasks.map((task) => task.name);

        showToast(
          <div translate="no" style={{ wordBreak: "break-word" }}>
            <b translate="yes">Overdue task{overdueTasks.length > 1 && "s"}: </b>
            {listFormat.format(taskNames)}
          </div>,
          {
            id: "overdue-tasks",
            type: "error",
            disableVibrate: true,
            preventDuplicate: true,
            visibleToasts: toasts,
            duration: 3400,
            icon: <RingAlarm animate sx={{ color: ColorPalette.red }} />,
            style: {
              borderColor: ColorPalette.red,
              boxShadow: user.settings.enableGlow ? `0 0 18px -8px ${ColorPalette.red}` : "none",
            },
          },
        );
      }
    },
    [listFormat, toasts, user.settings.enableGlow],
  );

  useEffect(() => {
    checkOverdueTasks(user.tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dndKitSensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTasks.findIndex((task) => task.id === active.id);
    const newIndex = orderedTasks.findIndex((task) => task.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // calculate new positions for all tasks in the new order
    const newOrdered = arrayMove(orderedTasks, oldIndex, newIndex);
    // assign position as index
    const updatedTasks = user.tasks.map((task) => {
      const idx = newOrdered.findIndex((t) => t.id === task.id);
      return idx !== -1 ? { ...task, position: idx, lastSave: new Date() } : task;
    });
    setUser((prevUser) => ({
      ...prevUser,
      tasks: updatedTasks,
    }));
    requestAnimationFrame(() => {
      setActiveDragId(null);
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  return (
    <>
      <TaskMenu />
      <TasksContainer style={{ marginTop: user.settings.showProgressBar ? "0" : "24px" }}>
        {user.tasks.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "8px" }}>
            {/* Removed TaskSort component */}
          </Box>
        )}
        {multipleSelectedTasks.length > 0 && (
          <SelectedTasksContainer>
            <div>
              <h3>
                {/* Replaced RadioButtonChecked with a simple text */}
                Selected {multipleSelectedTasks.length} task
                {multipleSelectedTasks.length > 1 ? "s" : ""}
              </h3>
              <span translate="no" style={{ fontSize: "14px", opacity: 0.8 }}>
                {listFormat.format(
                  multipleSelectedTasks
                    .map((taskId) => user.tasks.find((task) => task.id === taskId)?.name)
                    .filter((taskName) => taskName !== undefined) as string[],
                )}
              </span>
            </div>
            {/* TODO: add more features */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Tooltip title="Mark selected as done">
                <IconButton
                  sx={{ color: getFontColor(theme.secondary) }}
                  size="large"
                  onClick={handleMarkSelectedAsDone}
                >
                  <DoneAll />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete selected">
                <IconButton color="error" size="large" onClick={handleDeleteSelected}>
                  <Delete />
                </IconButton>
              </Tooltip>
              <Tooltip sx={{ color: getFontColor(theme.secondary) }} title="Cancel">
                <IconButton size="large" onClick={() => setMultipleSelectedTasks([])}>
                  <CancelRounded />
                </IconButton>
              </Tooltip>
            </div>
          </SelectedTasksContainer>
        )}
        {moveMode && (
          <SelectedTasksContainer>
            <div>
              <h3>
                <MoveUpRounded /> &nbsp; Move Mode Enabled
              </h3>
              <span>Organize tasks by dragging and dropping.</span>
            </div>
            <Button variant="contained" onClick={() => setMoveMode(false)}>
              Done
            </Button>
          </SelectedTasksContainer>
        )}
        {user.tasks.length !== 0 ? (
          moveMode ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              sensors={dndKitSensors}
            >
              <SortableContext
                items={orderedTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    features={{
                      enableLinks: true,
                      enableGlow: user.settings.enableGlow,
                      enableSelection: true,
                      enableMoveMode: true,
                    }}
                    selection={{
                      selectedIds: multipleSelectedTasks,
                      onSelect: handleSelectTask,
                      onDeselect: (taskId) =>
                        setMultipleSelectedTasks((prevTasks) =>
                          prevTasks.filter((id) => id !== taskId),
                        ),
                    }}
                    onContextMenu={(e: React.MouseEvent<Element>) => {
                      handleClick(e as unknown as React.MouseEvent<HTMLElement>, task.id);
                    }}
                    actions={
                      <TaskMenuButton
                        task={task}
                        onClick={(event) => handleClick(event, task.id)}
                      />
                    }
                    blur={selectedTaskId !== task.id && open && !isMobile}
                  />
                ))}
              </SortableContext>
              <DragOverlay
                dropAnimation={{
                  duration: 250,
                  easing: "ease-in-out",
                }}
              >
                {/* DRAG PREVIEW */}
                {activeDragId ? (
                  <TaskItem
                    task={orderedTasks.find((t) => t.id === activeDragId)!}
                    features={{
                      enableLinks: true,
                      enableGlow: user.settings.enableGlow,
                      enableSelection: false,
                      enableMoveMode: true,
                    }}
                    blur={false}
                    actions={
                      <TaskMenuButton
                        task={orderedTasks.find((t) => t.id === activeDragId)!}
                        onClick={(event) =>
                          handleClick(event, orderedTasks.find((t) => t.id === activeDragId)!.id)
                        }
                      />
                    }
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            orderedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                features={{
                  enableLinks: true,
                  enableGlow: user.settings.enableGlow,
                  enableSelection: true,
                  enableMoveMode: true,
                }}
                selection={{
                  selectedIds: multipleSelectedTasks,
                  onSelect: handleSelectTask,
                  onDeselect: (taskId) =>
                    setMultipleSelectedTasks((prevTasks) =>
                      prevTasks.filter((id) => id !== taskId),
                    ),
                }}
                onContextMenu={(e: React.MouseEvent<Element>) => {
                  handleClick(e as unknown as React.MouseEvent<HTMLElement>, task.id);
                }}
                actions={
                  <TaskMenuButton task={task} onClick={(event) => handleClick(event, task.id)} />
                }
                blur={selectedTaskId !== task.id && open && !isMobile}
              />
            ))
          )
        ) : (
          <NoTasks>
            <span>You don't have any tasks yet</span>
            <br />
            Click on the <span>+</span> button to add one
          </NoTasks>
        )}
        {user.tasks.length === 0 ? (
          <TaskNotFound>
            <b>No tasks found</b>
            <br />
            <div style={{ marginTop: "14px" }}>
              <TaskIcon scale={0.8} />
            </div>
          </TaskNotFound>
        ) : null}
        <EditTask
          open={editModalOpen}
          task={user.tasks.find((task) => task.id === selectedTaskId)}
          onClose={() => setEditModalOpen(false)}
        />
      </TasksContainer>
      <Dialog open={deleteDialogOpen} onClose={cancelDeleteTask}>
        <CustomDialogTitle
          title="Delete Task"
          subTitle="Are you sure you want to delete this task?"
          onClose={cancelDeleteTask}
          icon={<Delete />}
        />
        <DialogContent>
          {taskToDelete && (
            <TaskItem
              task={taskToDelete}
              features={{
                enableGlow: false,
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <DialogBtn onClick={cancelDeleteTask} color="primary">
            Cancel
          </DialogBtn>
          <DialogBtn onClick={confirmDeleteTask} color="error">
            <DeleteRounded /> &nbsp; Confirm Delete
          </DialogBtn>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteSelectedOpen}>
        <CustomDialogTitle
          title="Delete selected tasks"
          subTitle="Confirm to delete selected tasks"
          icon={<DeleteRounded />}
        />
        <DialogContent translate="no">
          {listFormat.format(
            multipleSelectedTasks
              .map((taskId) => user.tasks.find((task) => task.id === taskId)?.name)
              .filter((taskName) => taskName !== undefined) as string[],
          )}
        </DialogContent>
        <DialogActions>
          <DialogBtn onClick={() => setDeleteSelectedOpen(false)} color="primary">
            Cancel
          </DialogBtn>
          <DialogBtn
            onClick={() => {
              setUser((prevUser) => ({
                ...prevUser,
                tasks: prevUser.tasks.filter((task) => !multipleSelectedTasks.includes(task.id)),
                deletedTasks: [
                  ...(prevUser.deletedTasks || []),
                  ...multipleSelectedTasks.filter((id) => !prevUser.deletedTasks?.includes(id)),
                ],
              }));
              // Clear the selected task IDs after the operation
              setMultipleSelectedTasks([]);
              setDeleteSelectedOpen(false);
            }}
            color="error"
          >
            Delete
          </DialogBtn>
        </DialogActions>
      </Dialog>
    </>
  );
};
