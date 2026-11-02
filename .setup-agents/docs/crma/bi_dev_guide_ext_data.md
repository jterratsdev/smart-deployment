# CRM Analytics Developer Guide

> Synced: 2026-10-22

---

## Analytics External Data API Developer Guide

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.

---

## External Data API Limits

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.

---

## Prepare Data Files

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.

---

## Connect to Salesforce

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.

---

## Configure the Upload

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.

---

## Add the Data

# External Data

You can integrate external data into CRM Analytics to make the data available for
queries from lenses and designer.

      [Diagram of the process for uploading external data to CRM Analytics]

      The External Data API enables you to upload external data files to CRM Analytics. The
        External Data API can upload .csv files, and you can optionally specify the structure of your
        data by defining metadata in JSON format.

      The External Data API is available in API version 31 and later.

      The high-level steps for uploading external data by using the API are:


        Prepare your data in CSV format, and then create a metadata file to specify the structure
          of the data.

        - Connect programmatically to your Salesforce organization.

        Configure the upload by inserting a row into the InsightsExternalData object, and then set
          input values such as the name of the dataset, the format of the data, and the operation to
          perform on the data.

        Split your data into 10-MB chunks, and then upload the chunks to InsightsExternalDataPart
          objects.

        Start the upload by updating the Action field in the
          InsightsExternalData object.

        Monitor the InsightsExternalData object for status updates, and then verify that the file
          upload was successful.

**[External Data API Limits](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_limits.htm)**

When working with the External Data API, consider the following limits, in addition to the general CRM Analytics limits.

**[Prepare Data Files](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_prepare_data.htm)**

To upload external data from .csv files into a dataset, first prepare your data files.

**[Connect to Salesforce](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_connect_to_sf.htm)**

After preparing your data files, the next step in loading external data into CRM Analytics is to connect to your Salesforce organization by using standard Salesforce APIs.

**[Configure the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_configure_upload.htm)**

Configure the external data upload by inserting a row into the InsightsExternalData object and setting configuration values.

**[Add the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_add_data.htm)**

When uploading external data files, you can use the InsightsExternalDataPart object to load the data in smaller chunks.

**[Manage the Upload](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_manage_upload.htm)**

After you’ve created a header and uploaded the data parts by using the InsightsExternalData and InsightsExternalDataPart objects, update the Action field on the header object to Process to start processing the data.

**[Update the Data](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_incremental_upload.htm)**

After you upload data into a dataset, update it by adding, upserting, or removing data.

**[External Data Metadata Overview](atlas.en-us.bi_dev_guide_ext_data.meta/bi_dev_guide_ext_data/bi_ext_data_schema_overview.htm)**

To upload external data into a CRM Analytics dataset, make sure that you have prepared your data and metadata files.
