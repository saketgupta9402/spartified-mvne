import streamlit as st
from ai_module import top_sims_by_usage_rating_bill

st.title("AI-Driven IoT Billing Insights")
if st.button("Show Top SIMs"):
    data = top_sims_by_usage_rating_bill()
    st.write(data)