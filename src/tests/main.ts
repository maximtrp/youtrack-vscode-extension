// import the webdriver and the high level browser wrapper
const assert = require("assert").strict;
import { VSBrowser, WebDriver, ActivityBar } from "vscode-extension-tester";

// Create a Mocha suite
describe("My Test Suite", () => {
  let browser: VSBrowser;
  let driver: WebDriver;

  // initialize the browser and webdriver
  before(async () => {
    browser = VSBrowser.instance;
    driver = browser.driver;
  });

  // test whatever we want using webdriver, here we are just checking the page title
  it("Running extension", async () => {
    const youtrack = await new ActivityBar().getViewControl("YouTrack");
    await youtrack?.openView();
    const titlePart = await youtrack?.getTitle();
    assert.equal(titlePart, "YouTrack");
  });
});
