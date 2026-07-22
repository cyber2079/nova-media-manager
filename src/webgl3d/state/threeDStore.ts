/**
 * threeDStore — 3D 模块独立 Zustand store。
 *
 * 五大状态模块：module / loading / scene / characters / props / quests / performance / interaction / dialog
 * 仅从 src/webgl3d/ 内部 import，主应用通过 bridge/ 回调获知状态变更。
 *
 * Ref: [13_全局状态 §2](docs/webgl3d-spec/13_3D全局状态通用结构.md)
 */

import { create } from "zustand";

// ─── Sub-types ──────────────────────────────────────────────────────────

export interface ThemeMeta {
  themeId: string;
  themeName: Record<string, string>;
  version: string;
  heroImage?: string;
}

export interface CharacterState {
  visible: boolean;
  currentAnimation: string;
  position: [number, number, number];
  affectionLevel: number;
  interactionCount: number;
  lastInteractionAt: string | null;
}

export interface PropState {
  placed: boolean;
  position: [number, number, number];
  snappedTo: string | null;
  inInventory: boolean;
  lastMovedAt: string | null;
}

export interface QuestState {
  status: "locked" | "unlocked" | "in_progress" | "completed";
  currentStage: string | null;
  completedStages: string[];
  unlockedAt: string | null;
  completedAt: string | null;
}

export interface DialogChoice {
  id: string;
  textKey: string;
  nextDialogId?: string;
  action?: {
    type: string;
    target?: string;
    anim?: string;
    sceneId?: string;
    dialogId?: string;
  };
}

export type ModuleStatus = "uninitialized" | "loading" | "active" | "degraded" | "disabled";
export type LoadPhase = "idle" | "manifest" | "low_res" | "hd_streaming" | "complete";
export type QualityLevel = "high" | "medium" | "low";

// ─── Store interface ────────────────────────────────────────────────────

export interface ThreeDState {
  // Module
  module: {
    status: ModuleStatus;
    errorInfo: string | null;
    circuitBreakerOpen: boolean;
  };

  // Loading
  loading: {
    phase: LoadPhase;
    progress: number;
    currentItem: string | null;
    error: string | null;
  };

  // Scene
  scene: {
    currentSceneId: string | null;
    themeId: string | null;
    themeMeta: ThemeMeta | null;
    transition: "none" | "fade_in" | "fade_out" | "loading";
  };

  // Optional: characters
  characters: Record<string, CharacterState>;

  // Optional: props
  props: Record<string, PropState>;

  // Optional: quests
  quests: Record<string, QuestState>;

  // Performance (read-only)
  performance: {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    qualityLevel: QualityLevel;
  };

  // Interaction
  interaction: {
    hoveredObjectId: string | null;
    selectedObjectId: string | null;
    draggingPropId: string | null;
    activeDialogId: string | null;
    isCameraMoving: boolean;
  };

  // Dialog
  dialog: {
    currentDialogId: string | null;
    currentLineIndex: number;
    isTyping: boolean;
    choices: DialogChoice[];
  };

  // ─── Actions ────────────────────────────────────────────────────────

  setModuleStatus: (status: ModuleStatus, errorInfo?: string | null) => void;
  setCircuitBreakerOpen: (open: boolean) => void;
  setLoadingProgress: (phase: LoadPhase, progress: number, currentItem?: string | null) => void;
  setLoadingError: (error: string | null) => void;
  setCurrentScene: (sceneId: string | null, themeId?: string | null) => void;
  setThemeMeta: (meta: ThemeMeta | null) => void;
  setTransition: (transition: ThreeDState["scene"]["transition"]) => void;
  updateCharacterState: (charId: string, patch: Partial<CharacterState>) => void;
  updatePropState: (propId: string, patch: Partial<PropState>) => void;
  updateQuestState: (questId: string, patch: Partial<QuestState>) => void;
  setPerformance: (p: Partial<ThreeDState["performance"]>) => void;
  setHoveredObject: (id: string | null) => void;
  setSelectedObject: (id: string | null) => void;
  setDraggingProp: (id: string | null) => void;
  setActiveDialog: (id: string | null) => void;
  setCameraMoving: (moving: boolean) => void;
  setDialog: (patch: Partial<ThreeDState["dialog"]>) => void;
  selectChoice: (choice: DialogChoice) => void;
  advanceDialog: () => void;
  resetAll: () => void;
}

// ─── Initial state ──────────────────────────────────────────────────────

const initialState = {
  module: {
    status: "uninitialized" as ModuleStatus,
    errorInfo: null as string | null,
    circuitBreakerOpen: false,
  },
  loading: {
    phase: "idle" as LoadPhase,
    progress: 0,
    currentItem: null as string | null,
    error: null as string | null,
  },
  scene: {
    currentSceneId: null as string | null,
    themeId: null as string | null,
    themeMeta: null as ThemeMeta | null,
    transition: "none" as "none" | "fade_in" | "fade_out" | "loading",
  },
  characters: {} as Record<string, CharacterState>,
  props: {} as Record<string, PropState>,
  quests: {} as Record<string, QuestState>,
  performance: {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    qualityLevel: "high" as QualityLevel,
  },
  interaction: {
    hoveredObjectId: null as string | null,
    selectedObjectId: null as string | null,
    draggingPropId: null as string | null,
    activeDialogId: null as string | null,
    isCameraMoving: false,
  },
  dialog: {
    currentDialogId: null as string | null,
    currentLineIndex: 0,
    isTyping: false,
    choices: [] as DialogChoice[],
  },
};

// ─── Store ──────────────────────────────────────────────────────────────

export const useThreeDStore = create<ThreeDState>((set, get) => ({
  ...initialState,

  // Module
  setModuleStatus(status, errorInfo) {
    set(s => ({ module: { ...s.module, status, errorInfo: errorInfo ?? s.module.errorInfo } }));
  },
  setCircuitBreakerOpen(open) {
    set(s => ({ module: { ...s.module, circuitBreakerOpen: open } }));
  },

  // Loading
  setLoadingProgress(phase, progress, currentItem) {
    set(s => ({ loading: { ...s.loading, phase, progress, currentItem: currentItem ?? s.loading.currentItem } }));
  },
  setLoadingError(error) {
    set(s => ({ loading: { ...s.loading, error, phase: error ? "idle" : s.loading.phase } }));
  },

  // Scene
  setCurrentScene(sceneId, themeId) {
    set(s => ({ scene: { ...s.scene, currentSceneId: sceneId, themeId: themeId ?? s.scene.themeId } }));
  },
  setThemeMeta(meta) {
    set(s => ({ scene: { ...s.scene, themeMeta: meta } }));
  },
  setTransition(transition) {
    set(s => ({ scene: { ...s.scene, transition } }));
  },

  // Characters
  updateCharacterState(charId, patch) {
    set(s => ({
      characters: { ...s.characters, [charId]: { ...s.characters[charId], ...patch } },
    }));
  },

  // Props
  updatePropState(propId, patch) {
    set(s => ({
      props: { ...s.props, [propId]: { ...s.props[propId], ...patch } },
    }));
  },

  // Quests
  updateQuestState(questId, patch) {
    set(s => ({
      quests: { ...s.quests, [questId]: { ...s.quests[questId], ...patch } },
    }));
  },

  // Performance
  setPerformance(p) {
    set(s => ({ performance: { ...s.performance, ...p } }));
  },

  // Interaction
  setHoveredObject(id) { set(s => ({ interaction: { ...s.interaction, hoveredObjectId: id } })); },
  setSelectedObject(id) { set(s => ({ interaction: { ...s.interaction, selectedObjectId: id } })); },
  setDraggingProp(id) { set(s => ({ interaction: { ...s.interaction, draggingPropId: id } })); },
  setActiveDialog(id) { set(s => ({ interaction: { ...s.interaction, activeDialogId: id } })); },
  setCameraMoving(moving) { set(s => ({ interaction: { ...s.interaction, isCameraMoving: moving } })); },

  // Dialog
  setDialog(patch) {
    set(s => ({ dialog: { ...s.dialog, ...patch } }));
  },
  selectChoice(_choice) {
    // Advanced by host via setDialog — here as placeholder for future choice branching
  },
  advanceDialog() {
    set(s => ({ dialog: { ...s.dialog, currentLineIndex: s.dialog.currentLineIndex + 1, isTyping: true } }));
  },

  // Reset
  resetAll() {
    set({ ...initialState, characters: {}, props: {}, quests: {} });
  },
}));
