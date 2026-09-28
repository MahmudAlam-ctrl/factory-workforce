import sys
import json
import argparse
import re
from datetime import datetime
import pandas as pd
import numpy as np

# Column aliases mapping
SYNONYMS = {
    "employeeCode": ["employeecode", "employee_code", "employee id", "employeeid", "emp id", "empid", "code", "id", "worker id"],
    "firstName": ["firstname", "first_name", "first name"],
    "lastName": ["lastname", "last_name", "last name", "surname"],
    "fullName": ["fullname", "full_name", "name", "employee name", "worker name"],
    "phone": ["phone", "mobile", "mobile no", "mobile_no", "cell", "contact"],
    "department": ["department", "dept", "section"],
    "designation": ["designation", "position", "role", "job title", "title"],
    "joiningDate": ["joiningdate", "joining_date", "join date", "join_date", "doj", "date of join"],
    "baseSalary": ["basesalary", "base_salary", "basic salary", "basicsalary", "salary", "gross salary", "monthly salary", "wage"],
    "hourlyRate": ["hourlyrate", "hourly_rate", "rate", "ot rate", "overtime rate"],
    "status": ["status", "employment status", "active", "state"],
    "shiftName": ["shift", "shift name", "assigned shift", "schedule"]
}

def guess_column_mapping(columns):
    mapping = {}
    cleaned_cols = {col: re.sub(r'[^a-z0-9]', '', str(col).lower()) for col in columns}
    
    for field, aliases in SYNONYMS.items():
        for col, col_clean in cleaned_cols.items():
            for alias in aliases:
                alias_clean = re.sub(r'[^a-z0-9]', '', alias)
                if col_clean == alias_clean:
                    mapping[col] = field
                    break
            if col in mapping:
                break
    return mapping

def clean_excel(file_path, custom_mapping=None):
    df = pd.read_excel(file_path, sheet_name=0)
    
    # 1. Drop completely empty rows and columns
    df = df.dropna(how='all')
    if df.empty:
        return {
            "success": False,
            "error": "Uploaded Excel spreadsheet contains no data rows."
        }
    
    detected_cols = [str(c) for c in df.columns]
    mapping = guess_column_mapping(detected_cols)
    if custom_mapping:
        mapping.update(custom_mapping)
        
    inverted_mapping = {v: k for k, v in mapping.items()}
    
    # Track duplicates within file
    seen_codes = set()
    rows_output = []
    
    valid_count = 0
    warning_count = 0
    invalid_count = 0
    duplicate_count = 0
    
    for idx, raw_row in df.iterrows():
        row_num = int(idx) + 2 # Excel row (1-indexed + header)
        raw_dict = {str(k): (None if pd.isna(v) else v) for k, v in raw_row.to_dict().items()}
        
        # Check if entire row is empty
        if all(v is None for v in raw_dict.values()):
            continue
            
        warnings = []
        errors = []
        
        # Extract fields using mapping
        def get_val(field):
            col = inverted_mapping.get(field)
            if col and col in raw_row and not pd.isna(raw_row[col]):
                return raw_row[col]
            return None

        # Employee Code
        raw_code = get_val("employeeCode")
        code_str = str(raw_code).strip() if raw_code is not None else ""
        if code_str.endswith(".0"):
            code_str = code_str[:-2] # Handle float conversion like 1001.0
            
        if not code_str:
            errors.append("Missing Employee Code")
        elif code_str in seen_codes:
            errors.append(f"Duplicate Employee Code '{code_str}' in spreadsheet")
            duplicate_count += 1
        else:
            seen_codes.add(code_str)

        # Names
        first_name = str(get_val("firstName") or "").strip()
        last_name = str(get_val("lastName") or "").strip()
        full_name = str(get_val("fullName") or "").strip()
        
        if not first_name and full_name:
            parts = full_name.split()
            first_name = parts[0]
            last_name = " ".join(parts[1:]) if len(parts) > 1 else "."
            warnings.append("Split Full Name into First and Last name")
        elif not first_name:
            first_name = "Worker"
            warnings.append("Missing First Name; defaulted to 'Worker'")
        if not last_name:
            last_name = "."
            
        # Department & Designation
        dept = str(get_val("department") or "").strip() or "Sewing"
        designation = str(get_val("designation") or "").strip() or "Operator"
        
        # Phone
        raw_phone = get_val("phone")
        phone_str = ""
        if raw_phone is not None:
            phone_str = str(raw_phone).strip()
            if phone_str.endswith(".0"):
                phone_str = phone_str[:-2]
            # Strip non digits
            phone_clean = re.sub(r'[^0-9+]', '', phone_str)
            if len(phone_clean) >= 7:
                phone_str = phone_clean

        # Joining Date
        raw_doj = get_val("joiningDate")
        doj_str = datetime.now().strftime("%Y-%m-%d")
        if raw_doj is not None:
            try:
                if isinstance(raw_doj, (datetime, pd.Timestamp)):
                    doj_str = raw_doj.strftime("%Y-%m-%d")
                else:
                    parsed_date = pd.to_datetime(raw_doj)
                    doj_str = parsed_date.strftime("%Y-%m-%d")
            except Exception:
                warnings.append(f"Could not parse date '{raw_doj}'; defaulted to today")

        # Salary & Rate
        raw_salary = get_val("baseSalary")
        base_salary = 0.0
        if raw_salary is not None:
            # Handle text formatting like "15,000 BDT"
            salary_cleaned = re.sub(r'[^0-9.]', '', str(raw_salary))
            try:
                base_salary = float(salary_cleaned)
                if base_salary <= 0:
                    errors.append("Base Salary must be positive")
            except ValueError:
                errors.append(f"Invalid numeric salary '{raw_salary}'")
        else:
            errors.append("Missing Base Salary")
            
        raw_rate = get_val("hourlyRate")
        hourly_rate = 0.0
        if raw_rate is not None and not pd.isna(raw_rate):
            try:
                rate_cleaned = re.sub(r'[^0-9.]', '', str(raw_rate))
                hourly_rate = float(rate_cleaned)
            except ValueError:
                hourly_rate = round(base_salary / 208, 2)
        elif base_salary > 0:
            hourly_rate = round(base_salary / 208, 2)
            warnings.append(f"Calculated hourly rate ৳{hourly_rate} (Base / 208)")

        # Status
        raw_status = str(get_val("status") or "").strip().upper()
        if raw_status in ["INACTIVE", "DISABLED", "0", "FALSE", "LEFT"]:
            status_val = "INACTIVE"
        else:
            status_val = "ACTIVE"

        # Shift
        shift_name = str(get_val("shiftName") or "").strip() or None

        # Determine Row Status
        if errors:
            row_status = "INVALID"
            invalid_count += 1
        elif warnings:
            row_status = "WARNING"
            warning_count += 1
            valid_count += 1
        else:
            row_status = "VALID"
            valid_count += 1

        rows_output.append({
            "rowNumber": row_num,
            "rawData": raw_dict,
            "cleanedData": {
                "employeeCode": code_str,
                "firstName": first_name,
                "lastName": last_name,
                "phone": phone_str or None,
                "department": dept,
                "designation": designation,
                "joiningDate": doj_str,
                "baseSalary": base_salary,
                "hourlyRate": hourly_rate,
                "status": status_val,
                "shiftName": shift_name
            },
            "status": row_status,
            "validationNotes": errors + warnings
        })

    return {
        "success": True,
        "totalRows": len(rows_output),
        "validCount": valid_count,
        "warningCount": warning_count,
        "invalidCount": invalid_count,
        "duplicateCount": duplicate_count,
        "columnsDetected": detected_cols,
        "columnMapping": mapping,
        "rows": rows_output
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean and validate employee Excel files")
    parser.add_argument("--input", required=True, help="Path to Excel file")
    parser.add_argument("--mapping", required=False, help="JSON column mapping string")
    
    args = parser.parse_args()
    custom_map = json.loads(args.mapping) if args.mapping else None
    
    try:
        result = clean_excel(args.input, custom_map)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)