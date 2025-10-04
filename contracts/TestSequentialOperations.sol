// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TestSequentialOperations
 * @dev Test contract to demonstrate sequential transaction requirements
 * This contract has interdependent functions that must be called in order
 */
contract TestSequentialOperations {
    // State variables
    uint256 public counter;
    mapping(address => uint256) public userSteps;
    mapping(address => bool) public hasStarted;
    mapping(address => bool) public hasCompleted;
    mapping(uint256 => address) public stepOwners;
    
    // Events
    event SequenceStarted(address indexed user, uint256 timestamp);
    event StepCompleted(address indexed user, uint256 step, uint256 value);
    event SequenceCompleted(address indexed user, uint256 totalSteps, uint256 finalValue);
    event SequenceReset(address indexed user);
    
    // Errors
    error SequenceNotStarted();
    error SequenceAlreadyStarted();
    error InvalidStep(uint256 expected, uint256 provided);
    error SequenceAlreadyCompleted();
    error InsufficientValue();
    
    /**
     * @dev Start a new sequence for the sender
     * Must be called before any other steps
     */
    function startSequence() external {
        if (hasStarted[msg.sender] && !hasCompleted[msg.sender]) {
            revert SequenceAlreadyStarted();
        }
        
        hasStarted[msg.sender] = true;
        hasCompleted[msg.sender] = false;
        userSteps[msg.sender] = 1;
        counter++;
        
        emit SequenceStarted(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Execute step 2 - must be called after startSequence
     */
    function executeStep2(uint256 value) external {
        if (!hasStarted[msg.sender]) {
            revert SequenceNotStarted();
        }
        
        if (hasCompleted[msg.sender]) {
            revert SequenceAlreadyCompleted();
        }
        
        if (userSteps[msg.sender] != 1) {
            revert InvalidStep(1, userSteps[msg.sender]);
        }
        
        if (value < 100) {
            revert InsufficientValue();
        }
        
        userSteps[msg.sender] = 2;
        stepOwners[2] = msg.sender;
        counter += value;
        
        emit StepCompleted(msg.sender, 2, value);
    }
    
    /**
     * @dev Execute step 3 - must be called after executeStep2
     */
    function executeStep3() external payable {
        if (!hasStarted[msg.sender]) {
            revert SequenceNotStarted();
        }
        
        if (hasCompleted[msg.sender]) {
            revert SequenceAlreadyCompleted();
        }
        
        if (userSteps[msg.sender] != 2) {
            revert InvalidStep(2, userSteps[msg.sender]);
        }
        
        if (msg.value < 0.001 ether) {
            revert InsufficientValue();
        }
        
        userSteps[msg.sender] = 3;
        stepOwners[3] = msg.sender;
        counter++;
        
        emit StepCompleted(msg.sender, 3, msg.value);
    }
    
    /**
     * @dev Complete the sequence - must be called after executeStep3
     */
    function completeSequence() external returns (uint256) {
        if (!hasStarted[msg.sender]) {
            revert SequenceNotStarted();
        }
        
        if (hasCompleted[msg.sender]) {
            revert SequenceAlreadyCompleted();
        }
        
        if (userSteps[msg.sender] != 3) {
            revert InvalidStep(3, userSteps[msg.sender]);
        }
        
        hasCompleted[msg.sender] = true;
        userSteps[msg.sender] = 4;
        
        uint256 finalValue = counter * 1000;
        
        emit SequenceCompleted(msg.sender, 4, finalValue);
        
        return finalValue;
    }
    
    /**
     * @dev Reset user's sequence
     */
    function resetSequence() external {
        hasStarted[msg.sender] = false;
        hasCompleted[msg.sender] = false;
        userSteps[msg.sender] = 0;
        
        emit SequenceReset(msg.sender);
    }
    
    /**
     * @dev Get current state for a user
     */
    function getUserState(address user) external view returns (
        bool started,
        bool completed,
        uint256 currentStep
    ) {
        return (
            hasStarted[user],
            hasCompleted[user],
            userSteps[user]
        );
    }
    
    /**
     * @dev Check if a specific step can be executed
     */
    function canExecuteStep(address user, uint256 step) external view returns (bool) {
        if (!hasStarted[user] && step == 1) {
            return true;
        }
        
        if (!hasStarted[user] || hasCompleted[user]) {
            return false;
        }
        
        return userSteps[user] == step - 1;
    }
    
    /**
     * @dev Withdraw accumulated ETH (only owner)
     */
    function withdraw() external {
        require(msg.sender == address(this), "Only contract can withdraw");
        payable(msg.sender).transfer(address(this).balance);
    }
    
    // Receive function to accept ETH
    receive() external payable {}
}