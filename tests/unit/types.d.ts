declare module 'luaparse' {
  const luaparse: { parse(code: string, options?: { luaVersion?: string }): unknown };
  export default luaparse;
}
