// See https://v2.docusaurus.io/docs/configuration for more information.

module.exports = {
	title: "Immer",
	tagline: "Create the next immutable state by mutating the current one.",
	url: "https://immerjs.github.io/",
	baseUrl: process.env.NETLIFY_PREVIEW ? "/" : "/immer/",
	projectName: "immer",
	organizationName: "immerjs",
	onBrokenLinks: "throw",
	onBrokenMarkdownLinks: "warn",
	favicon: "img/favicon.ico",
	themeConfig: {
		googleAnalytics: {
			trackingID: "UA-65632006-3",
			anonymizeIP: true
		},
		navbar: {
			title: "Immer",
			style: "dark",
			logo: {
				src: "/img/immer-logo.svg",
				alt: "Immer Logo"
			},
			items: [
				{
					type: "doc",
					docId: "introduction",
					label: "Documentation",
					position: "right"
				},
				{
					href: "https://github.com/immerjs/immer",
					label: "GitHub",
					position: "right"
				},
				{
					type: "doc",
					docId: "support",
					label: "Support Immer",
					position: "right"
				}
			]
		},
		footer: {
			copyright: `Copyright © ${new Date().getFullYear()} Michel Weststrate`
		}
	},
	scripts: [
		"https://buttons.github.io/buttons.js",
		"https://media.ethicalads.io/media/client/ethicalads.min.js"
	],
	themes: [
		[
			"@docusaurus/theme-classic",
			{
				customCss: require.resolve("./src/css/immer-infima.css")
			}
		]
	],
	plugins: [
		[
			"@docusaurus/plugin-content-docs",
			{
				sidebarPath: require.resolve("./sidebars.js"),
				editUrl: "https://github.com/immerjs/immer/edit/master/website/",
				routeBasePath: "/"
			}
		],
		"@docusaurus/plugin-google-analytics",
		[
			"@docusaurus/plugin-client-redirects",
			{
				createRedirects: function(existingPath) {
					return ["/docs" + existingPath]
				}
			}
		]
	]
}
