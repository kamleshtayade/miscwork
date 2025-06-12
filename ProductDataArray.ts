import _ from 'lodash';

// Define the types for DataArray and ProductData
interface DataItem {
  primaryKey: number;
  property: string;
  valueLabel: string;
}

interface Product {
  category: string;
  subcategory: string;
  product: string;
}

interface ProductData {
  [key: string]: Product[];
}

// Sample product data
const productData: ProductData = {
  "Electronics": [
    { category: "Electronics", subcategory: "Mobile Phones", product: "iPhone 15 Pro" },
    { category: "Electronics", subcategory: "Laptops", product: "MacBook Air M2" },
  ],
  "Clothing": [
    { category: "Clothing", subcategory: "Men's Wear", product: "Cotton T-Shirt" },
  ],
  "Home & Garden": [
    { category: "Home & Garden", subcategory: "Kitchen Appliances", product: "Coffee Maker" },
  ],
};

// Define dependency fields
const dependency_fields = ['category', 'subcategory', 'product'] as const;

// Function to filter product data
const filterProductData = (
  dataArray: DataItem[],
  id: number,
  changedField: typeof dependency_fields[number], // Type-safe field name
  productData: ProductData
): Record<string, Product[]> => {
  // Step 1: Find the valueLabel based on id and changedField
  const foundItem = _.find(dataArray, { primaryKey: id, property: changedField });

  // Check if foundItem exists and if the property is in dependency_fields
  if (!foundItem || !dependency_fields.includes(foundItem.property as typeof dependency_fields[number])) {
    return {}; // Return empty if no match found
  }

  const valueLabel = foundItem.valueLabel;

  // Step 2: Filter the productData based on valueLabel
  const filteredData: Record<string, Product[]> = {};

  _.forEach(productData, (products, category) => {
    // Filter products that match the valueLabel
    const filteredProducts = _.filter(products, (product) =>
      _.get(product, changedField) === valueLabel
    );

    if (filteredProducts.length > 0) {
      filteredData[category] = filteredProducts;
    }
  });

  return filteredData;
};

// Example updated dataArray
const dataArray: DataItem[] = [
  { primaryKey: 1, property: "category", valueLabel: "Electronics" },
  { primaryKey: 1, property: "subcategory", valueLabel: "Mobile Phones" },
  { primaryKey: 1, property: "product", valueLabel: "iPhone 15 Pro" },
  { primaryKey: 1, property: "type", valueLabel: "sale" },
  { primaryKey: 1, property: "country", valueLabel: "IND" },
  { primaryKey: 2, property: "category", valueLabel: "Electronics" },
  { primaryKey: 2, property: "subcategory", valueLabel: "Laptops" },
  { primaryKey: 2, property: "product", valueLabel: "MacBook Air M2" },
  { primaryKey: 2, property: "type", valueLabel: "sale" },
  { primaryKey: 2, property: "country", valueLabel: "IND" },
  { primaryKey: 3, property: "category", valueLabel: "Clothing" },
  { primaryKey: 3, property: "subcategory", valueLabel: "Men's Wear" },
  { primaryKey: 5, property: "category", valueLabel: "Home & Garden" },
  { primaryKey: 5, property: "type", valueLabel: "buy" },
  { primaryKey: 5, property: "country", valueLabel: "IND" },
];

// User input
const id = 2;
const changedField: typeof dependency_fields[number] = "subcategory"; // Ensure type safety

// Get filtered product data
const result = filterProductData(dataArray, id, changedField, productData);
console.log(result);
