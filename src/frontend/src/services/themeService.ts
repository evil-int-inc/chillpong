/** ChillPong uses its custom daisyUI black theme at every hour. */
export const themeService = {
  initialize() {
    document.documentElement.setAttribute("data-theme", "black");
    document.documentElement.style.colorScheme = "dark";
  },
};
