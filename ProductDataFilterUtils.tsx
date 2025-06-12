
import _ from 'lodash';

// Generic type definitions
interface GenericDataItem {
  [key: string]: string | number;
}

interface DataArrayItem {
  primaryKey: number;
  property: string;
  valueLabel: string;
}

interface GenericFilterResult {
  [fieldName: string]: string[];
}

// Configuration constants
const DEPENDENCY_FIELDS = ['category', 'subcategory', 'product'] as const;
type DependencyField = typeof DEPENDENCY_FIELDS[number];

// Sample product data
const productData: GenericDataItem[] = [
  { category: "Electronics", subcategory: "Mobile Phones", product: "iPhone 15 Pro" },
  { category: "Electronics", subcategory: "Mobile Phones", product: "Samsung Galaxy S24" },
  { category: "Electronics", subcategory: "Mobile Phones", product: "Google Pixel 8" },
  { category: "Electronics", subcategory: "Laptops", product: "MacBook Air M2" },
  { category: "Electronics", subcategory: "Laptops", product: "Dell XPS 13" },
  { category: "Electronics", subcategory: "Laptops", product: "HP Spectre x360" },
  { category: "Electronics", subcategory: "Headphones", product: "Sony WH-1000XM5" },
  { category: "Electronics", subcategory: "Headphones", product: "Apple AirPods Pro" },
  { category: "Clothing", subcategory: "Men's Wear", product: "Cotton T-Shirt" },
  { category: "Clothing", subcategory: "Men's Wear", product: "Denim Jeans" },
  { category: "Clothing", subcategory: "Women's Wear", product: "Summer Dress" },
  { category: "Clothing", subcategory: "Women's Wear", product: "Blouse" },
  { category: "Home & Garden", subcategory: "Kitchen Appliances", product: "Coffee Maker" },
  { category: "Home & Garden", subcategory: "Kitchen Appliances", product: "Blender" },
  { category: "Home & Garden", subcategory: "Furniture", product: "Dining Table" },
  { category: "Home & Garden", subcategory: "Furniture", product: "Sofa Set" }
];

// Sample data array with additional fields
const dataArray: DataArrayItem[] = [
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
  { primaryKey: 5, property: "country", valueLabel: "IND" }
];

/**
 * Validates if the field name exists in dependency fields
 * @param fieldName - Field name to validate
 * @param dependencyFields - Array of valid field names
 * @returns boolean indicating if field is valid
 */
const isValidField = (fieldName: string, dependencyFields: readonly string[]): boolean => {
  return dependencyFields.includes(fieldName);
};

/**
 * Gets the hierarchy level of a field within dependency fields
 * @param fieldName - Field name to get level for
 * @param dependencyFields - Array of dependency fields in hierarchical order
 * @returns number representing the hierarchy level (0-based)
 */
const getFieldHierarchyLevel = (fieldName: string, dependencyFields: readonly string[]): number => {
  return dependencyFields.indexOf(fieldName);
};

/**
 * Generic utility function to filter data based on changed field with dependency handling
 * @param id - Primary key to search for
 * @param changedField - Field that was changed
 * @param dataArray - Array containing the mapping data
 * @param sourceData - Array containing the source data to filter
 * @param dependencyFields - Array of field names in hierarchical order
 * @returns Object with filtered arrays for each dependency field
 */
export const filterDataWithDependencies = <T extends GenericDataItem>(
  id: number,
  changedField: string,
  dataArray: DataArrayItem[],
  sourceData: T[],
  dependencyFields: readonly string[] = DEPENDENCY_FIELDS
): GenericFilterResult => {
  
  // Step 1: Find the valueLabel for the given id and changedField
  const targetItem = _.find(dataArray, { 
    primaryKey: id, 
    property: changedField 
  });

  if (!targetItem) {
    console.warn(`No item found for id: ${id} and changedField: ${changedField}`);
    return _.zipObject(dependencyFields, dependencyFields.map(() => []));
  }

  const { valueLabel } = targetItem;
  console.log(`Found valueLabel: "${valueLabel}" for field: "${changedField}"`);

  // Step 2: Get all user selections for the given ID
  const userSelections = _.filter(dataArray, { primaryKey: id });
  const currentSelections: { [key: string]: string } = {};
  
  // Build current selections map (include all fields, not just dependency fields)
  userSelections.forEach(selection => {
    currentSelections[selection.property] = selection.valueLabel;
  });

  // Step 3: Build filter criteria based on changed field
  const filterCriteria: Partial<T> = {};
  
  // If the changed field is part of dependency fields, use hierarchical filtering
  if (isValidField(changedField, dependencyFields)) {
    const changedFieldLevel = getFieldHierarchyLevel(changedField, dependencyFields);
    
    // Apply filters for fields up to and including the changed field level
    for (let i = 0; i <= changedFieldLevel; i++) {
      const fieldName = dependencyFields[i];
      if (currentSelections[fieldName]) {
        (filterCriteria as any)[fieldName] = currentSelections[fieldName];
      }
    }
  } else {
    // If changed field is not in dependency fields, just use it as a direct filter
    (filterCriteria as any)[changedField] = valueLabel;
    
    // Also apply any dependency field filters that exist
    dependencyFields.forEach(fieldName => {
      if (currentSelections[fieldName]) {
        (filterCriteria as any)[fieldName] = currentSelections[fieldName];
      }
    });
  }

  // Step 4: Filter the source data based on criteria
  let filteredData = sourceData;
  
  Object.entries(filterCriteria).forEach(([fieldName, value]) => {
    if (value && filteredData.length > 0) {
      // Check if the field exists in the source data
      const hasField = filteredData.some(item => item.hasOwnProperty(fieldName));
      if (hasField) {
        filteredData = _.filter(filteredData, { [fieldName]: value });
      }
    }
  });

  // Step 5: Extract unique values for each dependency field that exists in source data
  const result: GenericFilterResult = {};
  
  dependencyFields.forEach(fieldName => {
    // Only include fields that exist in the source data
    const fieldExists = sourceData.length > 0 && sourceData.some(item => item.hasOwnProperty(fieldName));
    
    if (fieldExists) {
      result[fieldName] = _.uniq(
        filteredData
          .map(item => item[fieldName])
          .filter(value => value !== undefined && value !== null)
          .map(value => String(value))
      );
    } else {
      result[fieldName] = [];
    }
  });

  return result;
};

/**
 * Specialized version for product data with default dependency fields
 * @param id - Primary key to search for
 * @param changedField - Field that was changed
 * @param dataArray - Array containing the mapping data
 * @param productData - Array containing the product catalog
 * @returns Object with filtered arrays for category, subcategory, and product
 */
export const filterProductData = (
  id: number,
  changedField: string,
  dataArray: DataArrayItem[],
  productData: GenericDataItem[]
): GenericFilterResult => {
  return filterDataWithDependencies(id, changedField, dataArray, productData, DEPENDENCY_FIELDS);
};

/**
 * Get available options for a specific field based on current selections
 * @param id - Primary key to search for
 * @param targetField - Field to get options for
 * @param dataArray - Array containing the mapping data
 * @param sourceData - Array containing the source data
 * @param dependencyFields - Array of field names in hierarchical order
 * @returns Array of available options for the target field
 */
export const getAvailableOptions = <T extends GenericDataItem>(
  id: number,
  targetField: string,
  dataArray: DataArrayItem[],
  sourceData: T[],
  dependencyFields: readonly string[] = DEPENDENCY_FIELDS
): string[] => {
  
  // Check if target field exists in source data
  const fieldExists = sourceData.length > 0 && sourceData.some(item => item.hasOwnProperty(targetField));
  if (!fieldExists) {
    console.warn(`Field "${targetField}" does not exist in source data`);
    return [];
  }

  // Get current selections for the ID
  const userSelections = _.filter(dataArray, { primaryKey: id });
  const currentSelections: { [key: string]: string } = {};
  
  userSelections.forEach(selection => {
    currentSelections[selection.property] = selection.valueLabel;
  });

  const filterCriteria: Partial<T> = {};
  
  // If target field is in dependency fields, apply hierarchical filtering
  if (isValidField(targetField, dependencyFields)) {
    const targetFieldLevel = getFieldHierarchyLevel(targetField, dependencyFields);
    
    // Apply filters for fields before the target field (parent dependencies)
    for (let i = 0; i < targetFieldLevel; i++) {
      const fieldName = dependencyFields[i];
      if (currentSelections[fieldName]) {
        (filterCriteria as any)[fieldName] = currentSelections[fieldName];
      }
    }
  }
  
  // Apply any other non-dependency field filters
  Object.keys(currentSelections).forEach(fieldName => {
    if (!isValidField(fieldName, dependencyFields) && fieldName !== targetField) {
      // Check if this field exists in source data
      const fieldExistsInSource = sourceData.some(item => item.hasOwnProperty(fieldName));
      if (fieldExistsInSource) {
        (filterCriteria as any)[fieldName] = currentSelections[fieldName];
      }
    }
  });

  // Filter source data based on criteria
  let filteredData = sourceData;
  Object.entries(filterCriteria).forEach(([fieldName, value]) => {
    if (value) {
      filteredData = _.filter(filteredData, { [fieldName]: value });
    }
  });

  // Return unique values for the target field
  return _.uniq(
    filteredData
      .map(item => item[targetField])
      .filter(value => value !== undefined && value !== null)
      .map(value => String(value))
  );
};

/**
 * Reset dependent fields when a parent field changes
 * @param id - Primary key to search for
 * @param changedField - Field that was changed
 * @param dataArray - Current data array
 * @param dependencyFields - Array of field names in hierarchical order
 * @returns Updated data array with dependent fields reset
 */
export const resetDependentFields = (
  id: number,
  changedField: string,
  dataArray: DataArrayItem[],
  dependencyFields: readonly string[] = DEPENDENCY_FIELDS
): DataArrayItem[] => {
  
  // If changed field is not in dependency fields, no reset needed
  if (!isValidField(changedField, dependencyFields)) {
    return dataArray;
  }

  const changedFieldLevel = getFieldHierarchyLevel(changedField, dependencyFields);
  
  // Remove entries for fields that come after the changed field in hierarchy
  return dataArray.filter(item => {
    if (item.primaryKey !== id) return true;
    
    // Keep the item if it's not a dependency field or if it's at or before the changed field level
    if (!isValidField(item.property, dependencyFields)) return true;
    
    const itemFieldLevel = getFieldHierarchyLevel(item.property, dependencyFields);
    return itemFieldLevel <= changedFieldLevel;
  });
};

// Example usage and testing
console.log("=== Testing Generic Filter Utility with Extended DataArray ===");

// Test case 1: User provided example (id=2, changedField="subcategory")
const result1 = filterProductData(2, "subcategory", dataArray, productData);
console.log("Test 1 - ID: 2, Changed Field: subcategory");
console.log("Result:", result1);

// Test case 2: Test with non-dependency field (type)
const result2 = filterDataWithDependencies(1, "type", dataArray, productData);
console.log("\nTest 2 - ID: 1, Changed Field: type (non-dependency field)");
console.log("Result:", result2);

// Test case 3: Test with missing fields in source data
const result3 = filterDataWithDependencies(5, "country", dataArray, productData);
console.log("\nTest 3 - ID: 5, Changed Field: country (field not in product data)");
console.log("Result:", result3);

// Test case 4: Custom dependency fields with location data
const customFields = ['region', 'country', 'city'] as const;
const locationData = [
  { region: "Asia", country: "India", city: "Mumbai" },
  { region: "Asia", country: "India", city: "Delhi" },  
  { region: "Asia", country: "Japan", city: "Tokyo" },
  { region: "Europe", country: "France", city: "Paris" }
];

const locationSelections = [
  { primaryKey: 1, property: "region", valueLabel: "Asia" },
  { primaryKey: 1, property: "country", valueLabel: "India" },
  { primaryKey: 1, property: "type", valueLabel: "business" }
];

const result4 = filterDataWithDependencies(1, "country", locationSelections, locationData, customFields);
console.log("\nTest 4 - Custom fields with non-dependency field mixed in");
console.log("Result:", result4);

// Test case 5: Get available options with mixed fields
const availableCategories = getAvailableOptions(1, "category", dataArray, productData);
console.log("\nTest 5 - Available categories for ID: 1 (with type and country filters)");
console.log("Available categories:", availableCategories);

// Test case 6: Reset dependent fields (should preserve non-dependency fields)
const originalEntries = dataArray.filter(item => item.primaryKey === 1);
const resetEntries = resetDependentFields(1, "category", dataArray);
const updatedEntries = resetEntries.filter(item => item.primaryKey === 1);

console.log("\nTest 6 - Reset dependent fields for ID: 1 after category change");
console.log("Original entries:", originalEntries);
console.log("After reset (should preserve type and country):", updatedEntries);

// Test case 7: Test with incomplete data (missing some dependency fields)
const result7 = filterDataWithDependencies(3, "category", dataArray, productData);
console.log("\nTest 7 - ID: 3, Changed Field: category (incomplete dependency data)");
console.log("Result:", result7);
Made with
