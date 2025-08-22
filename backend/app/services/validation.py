"""
Password validation service with comprehensive rules and error handling.
"""
import re
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class ValidationRule:
    """Single validation rule configuration"""
    name: str
    pattern: str
    message: str
    required: bool = True


@dataclass
class ValidationResult:
    """Result of password validation"""
    is_valid: bool
    errors: List[str]
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class PasswordValidator:
    """Simple password validation service with 3 rules"""
    
    # Simplified validation rules - only 3 requirements
    RULES = {
        "min_length": ValidationRule(
            name="min_length",
            pattern=r".{8,}",
            message="Password must be at least 8 characters long"
        ),
        "has_number": ValidationRule(
            name="has_number",
            pattern=r".*\d.*", 
            message="Password must contain at least one number"
        ),
        "has_symbol": ValidationRule(
            name="has_symbol",
            pattern=r".*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?].*",
            message="Password must contain at least one symbol"
        )
    }
    
    # Combined pattern for efficient validation
    COMBINED_PATTERN = r"^(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{8,}$"
    
    @classmethod
    def validate_password(cls, password: str) -> ValidationResult:
        """
        Simple password validation with 3 rules
        
        Args:
            password: The password to validate
            
        Returns:
            ValidationResult with validation status and error messages
        """
        if not password:
            return ValidationResult(
                is_valid=False,
                errors=["Password is required"]
            )
        
        errors = []
        
        # Check each rule individually for detailed error messages
        for rule_name, rule in cls.RULES.items():
            if not re.match(rule.pattern, password):
                errors.append(rule.message)
        
        is_valid = len(errors) == 0
        
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=[]
        )
    
    @classmethod
    def get_password_requirements(cls) -> Dict[str, str]:
        """Get human-readable password requirements"""
        return {
            "length": "At least 8 characters long",
            "number": "At least one number (0-9)",
            "symbol": "At least one symbol (e.g. !@#$%^&*)"
        }


class EmailValidator:
    """Email validation service"""
    
    EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    
    @classmethod
    def validate_email(cls, email: str) -> ValidationResult:
        """
        Validate email format
        
        Args:
            email: The email to validate
            
        Returns:
            ValidationResult with validation status and error messages
        """
        if not email:
            return ValidationResult(
                is_valid=False,
                errors=["Email is required"]
            )
        
        errors = []
        warnings = []
        
        # Basic format validation
        if not re.match(cls.EMAIL_PATTERN, email):
            errors.append("Please enter a valid email address")
        
        # Length validation
        if len(email) > 254:
            errors.append("Email address is too long (maximum 254 characters)")
        
        # Additional checks
        if email.count("@") != 1:
            errors.append("Email must contain exactly one @ symbol")
        
        # Check for consecutive dots
        if ".." in email:
            errors.append("Email cannot contain consecutive dots")
        
        # Check for dangerous characters
        dangerous_chars = ["<", ">", "\"", "'", "&"]
        if any(char in email for char in dangerous_chars):
            errors.append("Email contains invalid characters")
        
        is_valid = len(errors) == 0
        
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings
        )