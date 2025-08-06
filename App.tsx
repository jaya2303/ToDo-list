import { useContext, useCallback, useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material";
import { Theme } from "@mui/material";
import { UserContext } from "./contexts/UserContext";
import { TaskProvider } from "./contexts/TaskProvider";
import { AuthProvider } from "./contexts/AuthContext";

import { defaultUser } from "./constants/defaultUser";
import { useSystemTheme } from "./hooks/useSystemTheme";
import { Themes } from "./theme/createTheme";
import { showToast } from "./utils";
import { GlobalQuickSaveHandler } from "./components/GlobalQuickSaveHandler";
import ErrorBoundary from "./components/ErrorBoundary";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./router";
import { GlobalStyles } from "./styles";
import { CustomToaster } from "./components/Toaster";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { DeleteForeverRounded, DataObjectRounded } from "@mui/icons-material";

function App() {
  const { user, setUser } = useContext(UserContext);
  const systemTheme = useSystemTheme();

  // Initialize user properties if they are undefined
  // this allows to add new properties to the user object without error
  const updateNestedProperties = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userObject: any, defaultObject: any) => {
      if (!userObject) {
        return defaultObject;
      }

      Object.keys(defaultObject).forEach((key) => {
        if (key === "categories") {
          return;
        }
        if (
          key === "colorList" &&
          user.colorList &&
          !defaultUser.colorList.every((element, index) => element === user.colorList[index])
        ) {
          return;
        }

        if (key === "settings" && Array.isArray(userObject.settings)) {
          delete userObject.settings;
          showToast("Removed old settings array format.", {
            duration: 6000,
            icon: <DeleteForeverRounded />,
            disableVibrate: true,
          });
        }

        const userValue = userObject[key];
        const defaultValue = defaultObject[key];

        if (typeof defaultValue === "object" && defaultValue !== null) {
          userObject[key] = updateNestedProperties(userValue, defaultValue);
        } else if (userValue === undefined) {
          userObject[key] = defaultValue;
          showToast(
            <div>
              Added new property to user object{" "}
              <i translate="no">
                {key.toString()}: {userObject[key].toString()}
              </i>
            </div>,
            {
              duration: 6000,
              icon: <DataObjectRounded />,
              disableVibrate: true,
            },
          );
        }
      });

      return userObject;
    },
    [user.colorList],
  );

  useEffect(() => {
    setUser((prevUser) => {
      const updatedUser = updateNestedProperties({ ...prevUser }, defaultUser);
      return prevUser !== updatedUser ? updatedUser : prevUser;
    });
  }, [setUser, user.colorList, updateNestedProperties]);

  useEffect(() => {
    const setBadge = async (count: number) => {
      if ("setAppBadge" in navigator) {
        try {
          await navigator.setAppBadge(count);
        } catch (error) {
          console.error("Failed to set app badge:", error);
        }
      }
    };

    const clearBadge = async () => {
      if ("clearAppBadge" in navigator) {
        try {
          await navigator.clearAppBadge();
        } catch (error) {
          console.error("Failed to clear app badge:", error);
        }
      }
    };

    const displayAppBadge = async () => {
      if (user.settings.appBadge) {
        if ((await Notification.requestPermission()) === "granted") {
          const incompleteTasksCount = user.tasks.filter((task) => !task.done).length;
          if (!isNaN(incompleteTasksCount)) {
            setBadge(incompleteTasksCount);
          }
        }
      } else {
        clearBadge();
      }
    };

    if ("setAppBadge" in navigator) {
      displayAppBadge();
    }
  }, [user.settings.appBadge, user.tasks]);

  const getMuiTheme = useCallback((): Theme => {
    if (systemTheme === "unknown") {
      return Themes[0].MuiTheme;
    }
    if (user.theme === "system") {
      return systemTheme === "dark" ? Themes[0].MuiTheme : Themes[1].MuiTheme;
    }
    const selectedTheme = Themes.find((theme) => theme.name === user.theme);
    return selectedTheme ? selectedTheme.MuiTheme : Themes[0].MuiTheme;
  }, [systemTheme, user.theme]);

  useEffect(() => {
    const themeColorMeta = document.querySelector("meta[name=theme-color]");
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", getMuiTheme().palette.secondary.main);
    }
  }, [user.theme, getMuiTheme]);

  return (
    <MuiThemeProvider theme={getMuiTheme()}>
      <EmotionThemeProvider
        theme={{
          primary: getMuiTheme().palette.primary.main,
          secondary: getMuiTheme().palette.secondary.main,
          darkmode: user.darkmode === "dark" || (user.darkmode === "auto" && systemTheme === "dark"),
          mui: getMuiTheme(),
        }}
      >
        <GlobalStyles />
        <CustomToaster />
        <AuthProvider>
          <TaskProvider>
            <ErrorBoundary>
              <MainLayout>
                <GlobalQuickSaveHandler>
                  <AppRouter />
                </GlobalQuickSaveHandler>
              </MainLayout>
            </ErrorBoundary>
          </TaskProvider>
        </AuthProvider>
      </EmotionThemeProvider>
    </MuiThemeProvider>
  );
}

export default App;
