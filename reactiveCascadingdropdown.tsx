// Generic types
type DataItem = Record<string, any>;
type FieldValue = string | number | null;
type FilterMap = Record<string, FieldValue>;
type ChangeListener = (field: string, value: FieldValue, updatedOptions: DropdownState) => void;

interface DependencyConfig {
  field: string;
  dependsOn: string[];
}

interface DropdownState {
  currentSelections: FilterMap;
  availableOptions: Record<string, any[]>;
  filteredData: DataItem[];
}

class ReactiveCascadingDropdown<T extends DataItem> {
  private data: T[];
  private dependencies: DependencyConfig[];
  private state: FilterMap = {};
  private listeners: ChangeListener[] = [];

  constructor(data: T[], dependencies: DependencyConfig[]) {
    this.data = data;
    this.dependencies = this.sortDependencies(dependencies);
    this.initializeSelections();
  }

  // Sort dependencies by dependency depth (independent fields first)
  private sortDependencies(deps: DependencyConfig[]): DependencyConfig[] {
    return deps.sort((a, b) => a.dependsOn.length - b.dependsOn.length);
  }

  // Initialize all selections to null
  private initializeSelections(): void {
    this.dependencies.forEach(dep => {
      this.state[dep.field] = null;
    });
  }

  // Get filtered options for a specific field
  getOptions(field: string): any[] {
    const dependency = this.dependencies.find(d => d.field === field);
    if (!dependency) return [];

    // Apply parent filters
    let filteredData = this.data;
    dependency.dependsOn.forEach(parentField => {
      const parentValue = this.state[parentField];
      if (parentValue !== null && parentValue !== undefined) {
        filteredData = filteredData.filter(item => item[parentField] === parentValue);
      }
    });

    return [...new Set(filteredData.map(item => item[field]))]
      .filter(val => val !== null && val !== undefined)
      .sort();
  }

  // Get all available options for all fields based on current state
  getAllOptions(): Record<string, any[]> {
    return this.dependencies.reduce((acc, dep) => {
      acc[dep.field] = this.getOptions(dep.field);
      return acc;
    }, {} as Record<string, any[]>);
  }

  // Get data filtered by current selections
  getFilteredData(): T[] {
    return this.data.filter(item => 
      Object.entries(this.state).every(([field, value]) => 
        value === null || value === undefined || item[field] === value
      )
    );
  }

  // Get current dropdown state
  getCurrentState(): DropdownState {
    return {
      currentSelections: { ...this.state },
      availableOptions: this.getAllOptions(),
      filteredData: this.getFilteredData()
    };
  }

  // Select a value and trigger cascade updates
  select(field: string, value: FieldValue): DropdownState {
    // Update the selected field
    this.state[field] = value;
    
    // Reset all dependent fields
    this.resetDependentFields(field);
    
    // Get updated state
    const updatedState = this.getCurrentState();
    
    // Notify listeners
    this.notifyListeners(field, value, updatedState);
    
    return updatedState;
  }

  // Reset fields that depend on the changed field
  private resetDependentFields(changedField: string): void {
    this.dependencies
      .filter(dep => dep.dependsOn.includes(changedField))
      .forEach(dep => {
        const oldValue = this.state[dep.field];
        this.state[dep.field] = null;
        
        // Recursively reset dependent fields
        this.resetDependentFields(dep.field);
        
        // Notify if value actually changed
        if (oldValue !== null) {
          this.notifyListeners(dep.field, null, this.getCurrentState());
        }
      });
  }

  // Add change listener
  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(field: string, value: FieldValue, state: DropdownState): void {
    this.listeners.forEach(listener => {
      try {
        listener(field, value, state);
      } catch (error) {
        console.error('Error in dropdown change listener:', error);
      }
    });
  }

  // Reset all selections
  reset(): DropdownState {
    this.initializeSelections();
    const updatedState = this.getCurrentState();
    this.notifyListeners('reset', null, updatedState);
    return updatedState;
  }

  // Get selection sequence (ordered by dependency depth)
  getSelectionSequence(): string[] {
    return this.dependencies.map(dep => dep.field);
  }

  // Check if a field can be selected (all dependencies are satisfied)
  canSelect(field: string): boolean {
    const dependency = this.dependencies.find(d => d.field === field);
    if (!dependency) return false;
    
    return dependency.dependsOn.every(parentField => 
      this.state[parentField] !== null && this.state[parentField] !== undefined
    );
  }
}

// Product example with usage
interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  brand?: string;
}

const sampleProducts: Product[] = [
  { id: '1', name: 'iPhone 14', category: 'Electronics', subcategory: 'Smartphones', brand: 'Apple' },
  { id: '2', name: 'Galaxy S23', category: 'Electronics', subcategory: 'Smartphones', brand: 'Samsung' },
  { id: '3', name: 'MacBook Pro', category: 'Electronics', subcategory: 'Laptops', brand: 'Apple' },
  { id: '4', name: 'Running Shoes', category: 'Sports', subcategory: 'Footwear', brand: 'Nike' },
  { id: '5', name: 'T-Shirt', category: 'Clothing', subcategory: 'Casual', brand: 'H&M' }
];

const productDependencies: DependencyConfig[] = [
  { field: 'category', dependsOn: [] },
  { field: 'subcategory', dependsOn: ['category'] },
  { field: 'brand', dependsOn: ['category', 'subcategory'] },
  { field: 'name', dependsOn: ['category', 'subcategory', 'brand'] }
];

// Usage Example
const dropdownUtil = new ReactiveCascadingDropdown(sampleProducts, productDependencies);

// Listen to changes
const unsubscribe = dropdownUtil.onChange((field, value, state) => {
  console.log(`${field} changed to:`, value);
  console.log('Available options updated:', state.availableOptions);
  console.log('Filtered products count:', state.filteredData.length);
  console.log('---');
});

// Simulate selection sequence
console.log('Initial state:', dropdownUtil.getCurrentState().availableOptions);

console.log('\n1. Selecting category: Electronics');
dropdownUtil.select('category', 'Electronics');

console.log('\n2. Selecting subcategory: Smartphones');
dropdownUtil.select('subcategory', 'Smartphones');

console.log('\n3. Selecting brand: Apple');
dropdownUtil.select('brand', 'Apple');

console.log('\nFinal filtered products:', dropdownUtil.getFilteredData());

// Utility wrapper for easier integration
class DropdownUtility {
  static create<T extends DataItem>(data: T[], dependencies: DependencyConfig[]) {
    return new ReactiveCascadingDropdown(data, dependencies);
  }

  static createProductDropdown(products: Product[]) {
    return new ReactiveCascadingDropdown(products, [
      { field: 'category', dependsOn: [] },
      { field: 'subcategory', dependsOn: ['category'] },
      { field: 'brand', dependsOn: ['category', 'subcategory'] },
      { field: 'name', dependsOn: ['category', 'subcategory', 'brand'] }
    ]);
  }
}
