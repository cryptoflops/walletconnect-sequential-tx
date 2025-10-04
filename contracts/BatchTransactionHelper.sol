// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BatchTransactionHelper
 * @dev Helper contract for executing batch transactions with gas optimization
 * Implements multicall pattern for atomic transaction groups
 */
contract BatchTransactionHelper {
    // Events
    event BatchExecuted(address indexed sender, uint256 callsCount, uint256 successCount);
    event CallExecuted(uint256 indexed index, address target, bool success, bytes result);
    event BatchReverted(address indexed sender, uint256 failedIndex, bytes reason);
    
    // Errors
    error BatchCallFailed(uint256 index, bytes reason);
    error EmptyBatch();
    error InvalidTarget();
    error InsufficientValue();
    
    // Struct for batch calls
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }
    
    struct CallResult {
        bool success;
        bytes returnData;
    }
    
    /**
     * @dev Execute multiple calls in a single transaction
     * @param calls Array of calls to execute
     * @param atomic If true, revert if any call fails
     * @return results Array of results from each call
     */
    function executeBatch(
        Call[] calldata calls,
        bool atomic
    ) external payable returns (CallResult[] memory results) {
        if (calls.length == 0) {
            revert EmptyBatch();
        }
        
        results = new CallResult[](calls.length);
        uint256 totalValue = 0;
        
        // Check total value required
        for (uint256 i = 0; i < calls.length; i++) {
            totalValue += calls[i].value;
        }
        
        if (msg.value < totalValue) {
            revert InsufficientValue();
        }
        
        uint256 successCount = 0;
        
        // Execute each call
        for (uint256 i = 0; i < calls.length; i++) {
            if (calls[i].target == address(0)) {
                revert InvalidTarget();
            }
            
            (bool success, bytes memory returnData) = calls[i].target.call{
                value: calls[i].value
            }(calls[i].data);
            
            results[i] = CallResult({
                success: success,
                returnData: returnData
            });
            
            if (success) {
                successCount++;
                emit CallExecuted(i, calls[i].target, true, returnData);
            } else {
                emit CallExecuted(i, calls[i].target, false, returnData);
                
                if (atomic) {
                    emit BatchReverted(msg.sender, i, returnData);
                    revert BatchCallFailed(i, returnData);
                }
            }
        }
        
        emit BatchExecuted(msg.sender, calls.length, successCount);
        
        // Return excess ETH
        if (msg.value > totalValue) {
            payable(msg.sender).transfer(msg.value - totalValue);
        }
        
        return results;
    }
    
    /**
     * @dev Execute multiple calls with delegatecall
     * Useful for proxy patterns and library calls
     */
    function executeDelegateBatch(
        Call[] calldata calls,
        bool atomic
    ) external returns (CallResult[] memory results) {
        if (calls.length == 0) {
            revert EmptyBatch();
        }
        
        results = new CallResult[](calls.length);
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < calls.length; i++) {
            if (calls[i].target == address(0)) {
                revert InvalidTarget();
            }
            
            (bool success, bytes memory returnData) = calls[i].target.delegatecall(
                calls[i].data
            );
            
            results[i] = CallResult({
                success: success,
                returnData: returnData
            });
            
            if (success) {
                successCount++;
                emit CallExecuted(i, calls[i].target, true, returnData);
            } else {
                emit CallExecuted(i, calls[i].target, false, returnData);
                
                if (atomic) {
                    emit BatchReverted(msg.sender, i, returnData);
                    revert BatchCallFailed(i, returnData);
                }
            }
        }
        
        emit BatchExecuted(msg.sender, calls.length, successCount);
        
        return results;
    }
    
    /**
     * @dev Simulate batch execution without actually executing
     * Useful for gas estimation and testing
     */
    function simulateBatch(
        Call[] calldata calls
    ) external view returns (CallResult[] memory results, uint256 estimatedGas) {
        results = new CallResult[](calls.length);
        estimatedGas = 21000; // Base transaction cost
        
        for (uint256 i = 0; i < calls.length; i++) {
            if (calls[i].target == address(0)) {
                results[i] = CallResult({
                    success: false,
                    returnData: abi.encode("Invalid target")
                });
                continue;
            }
            
            // Estimate gas for each call
            estimatedGas += 5000; // Base call cost
            estimatedGas += calls[i].data.length * 16; // Data cost
            
            if (calls[i].value > 0) {
                estimatedGas += 9000; // Value transfer cost
            }
            
            // Try static call to check if it would succeed
            try this.staticCallTest(calls[i].target, calls[i].data) returns (bytes memory data) {
                results[i] = CallResult({
                    success: true,
                    returnData: data
                });
            } catch (bytes memory reason) {
                results[i] = CallResult({
                    success: false,
                    returnData: reason
                });
            }
        }
        
        return (results, estimatedGas);
    }
    
    /**
     * @dev Helper for static call testing
     */
    function staticCallTest(address target, bytes calldata data) 
        external 
        view 
        returns (bytes memory) 
    {
        (bool success, bytes memory returnData) = target.staticcall(data);
        if (!success) {
            revert BatchCallFailed(0, returnData);
        }
        return returnData;
    }
    
    /**
     * @dev Encode multiple function calls for a single target
     * Useful for preparing batch transactions
     */
    function encodeCalls(
        address target,
        bytes[] calldata data,
        uint256[] calldata values
    ) external pure returns (Call[] memory calls) {
        require(data.length == values.length, "Length mismatch");
        
        calls = new Call[](data.length);
        
        for (uint256 i = 0; i < data.length; i++) {
            calls[i] = Call({
                target: target,
                value: values[i],
                data: data[i]
            });
        }
        
        return calls;
    }
    
    /**
     * @dev Decode results from batch execution
     */
    function decodeResults(
        CallResult[] calldata results,
        bytes[] calldata expectedTypes
    ) external pure returns (bytes[] memory decodedResults) {
        require(results.length == expectedTypes.length, "Length mismatch");
        
        decodedResults = new bytes[](results.length);
        
        for (uint256 i = 0; i < results.length; i++) {
            if (results[i].success) {
                decodedResults[i] = results[i].returnData;
            } else {
                decodedResults[i] = abi.encode(false, results[i].returnData);
            }
        }
        
        return decodedResults;
    }
    
    // Receive function to accept ETH
    receive() external payable {}
}