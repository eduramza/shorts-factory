export default {
  content: {
    relative: true,
    files: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  },
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--accent)",
      },
    },
  },
  plugins: [],
};
