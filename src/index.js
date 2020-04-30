import cheerio from "cheerio";
import puppeteer from "puppeteer";

const storeURL = 'https://centralmilling.com/store/';

const radioValueToWeightMap = {
  '2-5-lb-bag-1-13-kg': '2.5lb',
  '5-lb-bag-2-26-kg': '5lb',
  '25-lb-bag-11-34-kg': '25lb',
  '50-lb-bag-22-68-kg': '50lb',
};

const getProductLinks = async (browser) => {
  const page = await browser.newPage();
  await page.goto(storeURL);
  const storePage = await page.content();
  const products = cheerio('.product-thumb > a', storePage);

  let urls = [];
  for (let i = 0; i < products.length; i++) {
    urls.push(products[i].attribs.href);
  }

  await page.close();
  return urls;
};

const productInformation = async (browser, productURL) => {

  try {
    const page = await browser.newPage();
    // some links can inconsistently take longer than 30 seconds to load.
    // this will get output to the console when the error is caught.
    // 60 second timeout seems to catch everything.
    await page.goto(productURL, { timeout: 60000 });
    const productPage = await page.content();
    const productName = cheerio('.product_title', productPage)
      .text();
    const purchaseOptions = cheerio('input[type=radio][name=attribute_pa_weight]', productPage);

    const availableOptions = [];
    const availableTags = purchaseOptions.filter((i, radioTag) => {
      return !radioTag.attribs.disabled;
    });
    for (let i = 0; i < availableTags.length; i++) {
      availableOptions.push(availableTags[i].attribs.value);
    }

    const unavailableOptions = [];
    const unavailableTags = purchaseOptions.filter((i, radioTag) => {
      return radioTag.attribs.disabled;
    });
    for (let i = 0; i < unavailableTags.length; i++) {
      unavailableOptions.push(unavailableTags[i].attribs.value);
    }

    return {
      productName,
      url: productURL,
      availableOptions,
      unavailableOptions,
    };

  } catch(error) {
    console.log(`error fetching url ${productURL}: ${error}`);

    return {
      productName: "",
      url: productURL,
      availableOptions: [],
      unavailableOptions: [],
    };
  }
};

const productName = (product) => {
  return product.productName;
};

const isAvailable = (product, weight) => {
  return product.availableOptions
    .map((item) => { return radioValueToWeightMap[item]; })
    .includes(weight);
};

const hasFivePoundBag = (product) => isAvailable(product, '5lb');
const hasTwentyFivePoundBag = (product) => isAvailable(product, '25lb');

const main = async () => {

  let browser;
  try {
    browser = await puppeteer.launch();
    const products = await getProductLinks(browser);

    const flattenedProducts = Object.values(
      products.reduce((acc, val) => {
        acc[val] = val;
        return acc;
      }, {})
    );

    const productInfoFuture = flattenedProducts.map((productURL) => {
      return productInformation(browser, productURL);
    });

    const productInfoList = await Promise.all(productInfoFuture);

    console.log(productInfoList);

    const fivePounders = productInfoList
      .filter(hasFivePoundBag)
      .map(productName);

    const twentyFivePounders = productInfoList
      .filter(hasTwentyFivePoundBag)
      .map(productName);

    console.log(`FIVE POUND BAGS : \n${fivePounders.join('\n')}`);
    console.log(`TWENTY FIVE POUND BAGS : \n${twentyFivePounders.join('\n')}`);

    await browser.close();

  } catch(error) {
    console.log(error);
    if (browser) {
      await browser.close();
    }
  }
};

main();
