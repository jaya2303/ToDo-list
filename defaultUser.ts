import { EmojiStyle } from "emoji-picker-react";
import type { User } from "../types/user";
import { systemInfo } from "../utils";

/**
 * Represents a default user object.
 */
export const defaultUser: User = {
  name: null,
  createdAt: new Date(),
  profilePicture: null,
  emojisStyle:
    systemInfo.os === "iOS" || systemInfo.os === "macOS" ? EmojiStyle.NATIVE : EmojiStyle.APPLE,
  tasks: [],
  categories: [],
  deletedTasks: [],
  deletedCategories: [],
  theme: "Ocean Blue",
  darkmode: "auto",
  settings: {
    doneToBottom: false,
    enableGlow: true,
    enableCategories: true,
    simpleEmojiPicker: false,
    enableReadAloud: false,
    appBadge: false,
    showProgressBar: false,
  },
  //TODO: make default colors better
  colorList: [
    "#FF69B4",
    "#FF22B4",
    "#C6A7FF",
    "#7ACCFA",
    "#4898F4",
    "#5061FF",
    "#3DFF7F",
    "#3AE836",
    "#FFEA28",
    "#F9BE26",
    "#FF9518",
    "#FF5018",
    "#FF2F2F",
  ],
};
