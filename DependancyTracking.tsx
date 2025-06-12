
import React, { useEffect, useMemo, useRef } from 'react';

const YourComponent = (props) => {
  const dependency_fields = ['category', 'subcategory', 'product'];
  const previousRelevantDataRef = useRef(null);

  // Extract and memoize relevant data from props.dataArray
  const currentRelevantData = useMemo(() => {
    if (!props.dataArray || !Array.isArray(props.dataArray)) return {};
    
    // Create a normalized structure for comparison
    const relevantData = {};
    
    props.dataArray
      .filter(item => dependency_fields.includes(item.property))
      .forEach(item => {
        const key = `${item.primaryKey}-${item.property}`;
        relevantData[key] = {
          primaryKey: item.primaryKey,
          property: item.property,
          valueLabel: item.valueLabel
        };
      });
    
    return relevantData;
  }, [props.dataArray]);

  // Convert to string for deep comparison
  const currentRelevantDataString = useMemo(() => {
    return JSON.stringify(currentRelevantData, Object.keys(currentRelevantData).sort());
  }, [currentRelevantData]);

  // Method to call when dependency fields change
  const handleDependencyFieldsChange = (changedData, previousData) => {
    console.log('✅ Dependency fields changed!');
    console.log('Previous data:', previousData);
    console.log('Current data:', changedData);
    
    // Find specific changes
    const changes = findChanges(previousData, changedData);
    console.log('Detected changes:', changes);
    
    // Your custom method call here
    // e.g., updateDependentComponents(changedData);
    // e.g., validateData(changedData);
    // e.g., triggerRecomputation(changes);
  };

  // Helper function to find specific changes
  const findChanges = (previous, current) => {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };

    // Find added items
    Object.keys(current).forEach(key => {
      if (!previous[key]) {
        changes.added.push(current[key]);
      } else if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changes.modified.push({
          key,
          previous: previous[key],
          current: current[key]
        });
      }
    });

    // Find removed items
    Object.keys(previous).forEach(key => {
      if (!current[key]) {
        changes.removed.push(previous[key]);
      }
    });

    return changes;
  };

  // useEffect to detect changes in dependency fields only
  useEffect(() => {
    const previousData = previousRelevantDataRef.current;
    
    // Skip on initial mount if no previous data
    if (previousData === null) {
      previousRelevantDataRef.current = currentRelevantData;
      return;
    }

    // Compare current with previous
    const previousDataString = JSON.stringify(previousData, Object.keys(previousData).sort());
    
    if (currentRelevantDataString !== previousDataString) {
      // Change detected in dependency fields
      handleDependencyFieldsChange(currentRelevantData, previousData);
    } else {
      console.log('ℹ️ Props.dataArray changed but no dependency fields affected');
    }

    // Update reference for next comparison
    previousRelevantDataRef.current = currentRelevantData;
    
  }, [currentRelevantDataString, currentRelevantData]);

  return (
    <div>
      <h3>Dependency Fields Tracker</h3>
      <p>Monitoring fields: {dependency_fields.join(', ')}</p>
      <p>Current relevant items: {Object.keys(currentRelevantData).length}</p>
      
      <details>
        <summary>Current Relevant Data</summary>
        <pre>{JSON.stringify(currentRelevantData, null, 2)}</pre>
      </details>
    </div>
  );
};

export default YourComponent;
Made with
1
