({
    appDir: "game",
    baseUrl: "client",
    dir: "public/js/game",
    removeCombined: true,
    fileExclusionRegExp: /(^\.)|(server)/,
    modules: [
      {
        name: "init"
      }
    ]
})
