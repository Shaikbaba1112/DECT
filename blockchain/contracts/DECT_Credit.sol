// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DECT_Credit {

    // ─────────────────────────────────────────────
    //  ERC-20 State
    // ─────────────────────────────────────────────

    string  public name     = "DECT Credit";
    string  public symbol   = "TKN";
    uint8   public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ─────────────────────────────────────────────
    //  Access Control
    // ─────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public minters; // contracts allowed to mint

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyMinter() {
        require(
            minters[msg.sender] || msg.sender == owner,
            "Not authorized to mint"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────
    //  Minter Management
    // ─────────────────────────────────────────────

    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid address");
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    // ─────────────────────────────────────────────
    //  Mint / Burn
    // ─────────────────────────────────────────────

    function mint(address _to, uint256 _amount)
        external
        onlyMinter
    {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0,       "Amount must be > 0");

        totalSupply     += _amount;
        balanceOf[_to]  += _amount;

        emit Transfer(address(0), _to, _amount);
        emit Minted(_to, _amount);
    }

    function burn(uint256 _amount) external {
        require(balanceOf[msg.sender] >= _amount, "Insufficient balance");
        require(_amount > 0, "Amount must be > 0");

        balanceOf[msg.sender] -= _amount;
        totalSupply           -= _amount;

        emit Transfer(msg.sender, address(0), _amount);
        emit Burned(msg.sender, _amount);
    }

    function burnFrom(address _from, uint256 _amount) external {
        require(allowance[_from][msg.sender] >= _amount, "Insufficient allowance");
        require(balanceOf[_from] >= _amount,             "Insufficient balance");

        allowance[_from][msg.sender] -= _amount;
        balanceOf[_from]             -= _amount;
        totalSupply                  -= _amount;

        emit Transfer(_from, address(0), _amount);
        emit Burned(_from, _amount);
    }

    // ─────────────────────────────────────────────
    //  ERC-20 Core
    // ─────────────────────────────────────────────

    function transfer(address _to, uint256 _amount)
        external
        returns (bool)
    {
        require(_to != address(0),                 "Cannot transfer to zero");
        require(balanceOf[msg.sender] >= _amount,  "Insufficient balance");

        balanceOf[msg.sender] -= _amount;
        balanceOf[_to]        += _amount;

        emit Transfer(msg.sender, _to, _amount);
        return true;
    }

    function approve(address _spender, uint256 _amount)
        external
        returns (bool)
    {
        require(_spender != address(0), "Invalid spender");
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    )
        external
        returns (bool)
    {
        require(_to != address(0),               "Cannot transfer to zero");
        require(balanceOf[_from] >= _amount,     "Insufficient balance");
        require(
            allowance[_from][msg.sender] >= _amount,
            "Insufficient allowance"
        );

        allowance[_from][msg.sender] -= _amount;
        balanceOf[_from]             -= _amount;
        balanceOf[_to]               += _amount;

        emit Transfer(_from, _to, _amount);
        return true;
    }

    // ─────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────

    function getBalance(address _account)
        external
        view
        returns (uint256)
    {
        return balanceOf[_account];
    }
}